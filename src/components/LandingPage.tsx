import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle, Users, FileText, Smartphone } from "lucide-react";

const LandingPage = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .insert([{ email }]);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already signed up!",
            description: "This email is already on our waitlist.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        setIsSubmitted(true);
        setEmail("");
        toast({
          title: "Success!",
          description: "You've been added to our waitlist. We'll notify you when TimeHatch launches!",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToSignup = () => {
    document.getElementById('signup')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6">
              Effortless time tracking for{" "}
              <span className="text-primary">freelancers</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Simple start/stop timer, seamless project and client management, 
              and clean reports that help you focus on what matters most.
            </p>
            <Button 
              onClick={scrollToSignup}
              size="lg" 
              className="text-lg px-8 py-6 h-auto"
            >
              Join the Waitlist
            </Button>
          </div>
        </div>
      </section>

      {/* Feature Teaser Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to track time efficiently
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              TimeHatch is designed specifically for freelancers who want to focus on their work, 
              not on complicated time-tracking software.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="text-center border-0 shadow-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Intuitive Time Tracking</h3>
                <p className="text-muted-foreground">
                  One-click start/stop timer that works seamlessly across all your devices.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Project Management</h3>
                <p className="text-muted-foreground">
                  Organize your work by projects and clients with clear, visual dashboards.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Smart Reporting</h3>
                <p className="text-muted-foreground">
                  Generate professional reports and invoices with detailed time breakdowns.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Modern UI/UX</h3>
                <p className="text-muted-foreground">
                  Beautiful, responsive design that works perfectly on desktop and mobile.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Signup Section */}
      <section id="signup" className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Be the first to know when TimeHatch launches
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join our waitlist to get early access and exclusive updates about TimeHatch's development.
            </p>

            {isSubmitted ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
                <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-primary mb-2">Thank you for joining!</h3>
                <p className="text-muted-foreground">
                  We'll keep you updated on our progress and notify you as soon as TimeHatch is ready.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  size="lg"
                  className="whitespace-nowrap"
                >
                  {isLoading ? "Joining..." : "Join the Waitlist"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Coming Soon / About Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Coming Soon
            </h2>
            <p className="text-lg text-muted-foreground mb-6">
              TimeHatch is currently in active development. We're building something special – 
              a time-tracking tool that actually makes your life easier, not more complicated.
            </p>
            <p className="text-lg text-muted-foreground mb-8">
              By joining our waitlist, you'll get exclusive early access and help shape the future 
              of TimeHatch with your feedback. We respect your privacy and will never share your 
              email with third parties. You can unsubscribe at any time.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Questions? Contact us at hello@timehatch.app</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;