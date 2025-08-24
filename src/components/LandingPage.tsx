import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, CheckCircle, Users, FileText, Smartphone, Timer } from "lucide-react";
import heroImage from "@/assets/freelancer-hero.jpg";

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
      <header>
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-muted/30 to-background">
          <div className="container mx-auto px-4 py-16 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="text-left">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
                  Effortless time tracking for{" "}
                  <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    freelancers
                  </span>
                </h1>
                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                  Simple start/stop timer, seamless project and client management, 
                  and clean reports that help you focus on what matters most.
                </p>
                
                {/* Email Signup Above the Fold */}
                {isSubmitted ? (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 max-w-md" role="alert">
                    <CheckCircle className="w-8 h-8 text-primary mb-3" aria-hidden="true" />
                    <h3 className="text-lg font-semibold text-primary mb-2">Thank you for joining!</h3>
                    <p className="text-muted-foreground text-sm">
                      We'll notify you as soon as TimeHatch is ready.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="flex-1 h-12 bg-background border-2 border-border focus:border-primary"
                      aria-label="Email address for waitlist signup"
                    />
                    <Button 
                      type="submit" 
                      disabled={isLoading}
                      className="h-12 px-8 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 shadow-md hover:shadow-lg transition-all duration-200"
                      aria-describedby={isLoading ? "loading-status" : undefined}
                    >
                      {isLoading ? "Joining..." : "Join Waitlist"}
                    </Button>
                    {isLoading && <span id="loading-status" className="sr-only">Processing your request</span>}
                  </form>
                )}
                
                <p className="text-sm text-muted-foreground mt-4">
                  <Timer className="w-4 h-4 inline mr-2" />
                  Be the first to know when we launch
                </p>
              </div>
              
              <div className="lg:order-2">
                <img 
                  src={heroImage} 
                  alt="Freelancer working with time tracking dashboard showing project management and productivity tools"
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
              </div>
            </div>
          </div>
        </section>
      </header>

      <main>
        {/* Feature Teaser Section */}
        <section className="py-20 bg-background" aria-labelledby="features-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Everything you need to track time efficiently
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                TimeHatch is designed specifically for freelancers who want to focus on their work, 
                not on complicated time-tracking software.
              </p>
            </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="group text-center border border-border/50 hover:border-primary/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <Clock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Intuitive Time Tracking</h3>
                <p className="text-muted-foreground leading-relaxed">
                  One-click start/stop timer that works seamlessly across all your devices.
                </p>
              </CardContent>
            </Card>

            <Card className="group text-center border border-border/50 hover:border-accent/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-accent/10 to-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <Users className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Project Management</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Organize your work by projects and clients with clear, visual dashboards.
                </p>
              </CardContent>
            </Card>

            <Card className="group text-center border border-border/50 hover:border-primary/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Smart Reporting</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate professional reports and invoices with detailed time breakdowns.
                </p>
              </CardContent>
            </Card>

            <Card className="group text-center border border-border/50 hover:border-accent/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-accent/10 to-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300" aria-hidden="true">
                  <Smartphone className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Modern UI/UX</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Beautiful, responsive design that works perfectly on desktop and mobile.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/5 to-accent/5" aria-labelledby="cta-heading">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 id="cta-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Ready to transform your freelance productivity?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Join thousands of freelancers who are already excited about TimeHatch. 
              Get early access and help shape the future of time tracking.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="flex items-center text-muted-foreground">
                <CheckCircle className="w-5 h-5 text-accent mr-2" />
                <span>Simple project management</span>
              </div>
              <div className="flex items-center text-muted-foreground">
                <CheckCircle className="w-5 h-5 text-accent mr-2" />
                <span>Beautiful reports</span>
              </div>
              <div className="flex items-center text-muted-foreground">
                <CheckCircle className="w-5 h-5 text-accent mr-2" />
                <span>No credit card required</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      </main>

      <footer>
        {/* Coming Soon / About Section */}
        <section className="py-20 bg-muted/20 border-t border-border/50" aria-labelledby="about-heading">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Timer className="w-8 h-8 text-white" />
              </div>
              <h2 id="about-heading" className="text-3xl font-bold text-foreground mb-6">
                Coming Soon
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                TimeHatch is currently in active development. We're building something special – 
                a time-tracking tool that actually makes your freelance life easier, not more complicated.
              </p>
              <p className="text-muted-foreground mb-8">
                We respect your privacy and will never share your email with third parties. 
                You can unsubscribe at any time.
              </p>
              
              <div className="border-t border-border/50 pt-8 mt-8">
                <address className="text-sm text-muted-foreground not-italic">
                  <p>Questions? Contact us at{" "}
                    <a 
                      href="mailto:hello@timehatch.app" 
                      className="text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      hello@timehatch.app
                    </a>
                  </p>
                </address>
              </div>
            </div>
          </div>
        </section>
      </footer>
    </div>
  );
};

export default LandingPage;