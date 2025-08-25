import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useUtmParams } from "@/hooks/useUtmParams";
import { Loader2, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface LeadFormProps {
  className?: string;
  variant?: "hero" | "compact";
}

const LeadForm = ({ className = "", variant = "hero" }: LeadFormProps) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState(""); // Spam protection
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  
  const { toast } = useToast();
  const utmParams = useUtmParams();
  const navigate = useNavigate();


  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!consent) {
      newErrors.consent = "You must agree to be contacted";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Spam protection - if honeypot field is filled, it's likely a bot
    if (honeypot) return;
    
    if (!validateForm()) return;

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([{ email }]);

      if (error) throw error;
      setIsSubmitted(true);
      toast({
        title: "Success!",
        description: "You've been added to our waitlist. We'll notify you when TimeHatch is ready!",
      });
      
      // Redirect to success page after a short delay
      setTimeout(() => {
        navigate('/success');
      }, 1500);
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: "Something went wrong",
        description: "Please try again or contact support if the problem persists.",
        variant: "destructive",
      });
      navigate('/error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted && variant === "hero") {
    return (
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 max-w-md" role="alert">
        <CheckCircle className="w-8 h-8 text-primary mb-3" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-primary mb-2">You're on the list!</h3>
        <p className="text-muted-foreground text-sm">
          We'll email you when TimeHatch beta is ready.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      {/* Honeypot field for spam protection */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{ display: 'none' }}
        tabIndex={-1}
        autoComplete="off"
      />
      
      {variant === "hero" ? (
        <div className="flex flex-col gap-4 max-w-md w-full">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 bg-background border-2 border-border focus:border-primary w-full"
              aria-label="Email address for waitlist signup"
            />
            {errors.email && (
              <p className="text-sm text-destructive" role="alert">{errors.email}</p>
            )}
          </div>
          <Button 
            type="submit" 
            disabled={isLoading}
            className="h-12 px-8 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-md hover:shadow-lg transition-all duration-200 w-full"
            aria-describedby={isLoading ? "loading-status" : undefined}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Joining...
              </>
            ) : (
              "Get Early Access + 30% Launch Discount"
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full"
              aria-label="Email address"
            />
            {errors.email && (
              <p className="text-sm text-destructive mt-1" role="alert">{errors.email}</p>
            )}
          </div>
          
          <div>
            <Input
              type="text"
              placeholder="Name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full"
              aria-label="Full name (optional)"
            />
          </div>
        </div>
      )}
      
      <div className="flex items-start space-x-2">
        <Checkbox
          id="consent"
          checked={consent}
          onCheckedChange={(checked) => setConsent(checked === true)}
          className="mt-1"
        />
        <Label htmlFor="consent" className="text-sm text-muted-foreground leading-relaxed">
          I agree to be contacted about TimeHatch (you can unsubscribe anytime).
        </Label>
      </div>
      {errors.consent && (
        <p className="text-sm text-destructive" role="alert">{errors.consent}</p>
      )}
      
      {variant === "compact" && (
        <Button 
          type="submit" 
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Joining...
            </>
           ) : (
             "Join the Waitlist – Get 30% Off at Launch"
           )}
         </Button>
       )}
      
       {isLoading && <span id="loading-status" className="sr-only">Processing your request</span>}
    </form>
  );
};

export default LeadForm;