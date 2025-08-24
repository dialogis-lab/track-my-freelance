import { Timer, Clock, Users, FileText, BarChart3, Zap, Bell, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LeadForm from "./LeadForm";
import { Link } from "react-router-dom";
import { useCookieContext } from "@/components/CookieProvider";
import { BrandLogo } from "./BrandLogo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const NewLandingPage = () => {
  const { openModal } = useCookieContext();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <BrandLogo size="md" />
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
              <a href="#faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-32 bg-gradient-to-br from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <div className="mb-6">
              <BrandLogo size="xl" noLink />
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Track your time.{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Grow your business.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed max-w-3xl mx-auto">
              Simple time tracking for freelancers and small teams — manage projects, 
              track clients, and create clear reports that help you get paid faster.
            </p>
            
            <div className="max-w-md mx-auto mb-8">
              <LeadForm variant="hero" />
            </div>
            
            <p className="text-sm text-muted-foreground">
              <Timer className="w-4 h-4 inline mr-2" />
              Join 1,000+ freelancers waiting for the simplest time tracking app
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-background" aria-labelledby="features-heading">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 id="features-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need for effortless time tracking
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built specifically for freelancers and small teams who need simple project management 
              and reliable time tracking without complexity.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="group text-center border border-border/50 hover:border-primary/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Clock className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Start/Stop Timers with Notes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Track work hours with one-click timer. Add notes for detailed project tracking and accurate time logging.
                </p>
              </CardContent>
            </Card>

            <Card className="group text-center border border-border/50 hover:border-accent/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-accent/10 to-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Clear Reports by Client/Project</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate professional reports with detailed work hours breakdown. Perfect for freelance billing and client invoices.
                </p>
              </CardContent>
            </Card>

            <Card className="group text-center border border-border/50 hover:border-primary/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Lightweight Client & Project Management</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Organize freelance projects effortlessly. Simple client management designed for freelance productivity.
                </p>
              </CardContent>
            </Card>

            <Card className="group text-center border border-border/50 hover:border-accent/30 shadow-sm hover:shadow-lg transition-all duration-300 bg-card/50 backdrop-blur-sm">
              <CardContent className="pt-8 pb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-accent/10 to-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Bell className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-foreground">Optional Reminders</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Daily and weekly reminders help you maintain consistent time tracking habits for better freelance productivity.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-muted/20" aria-labelledby="how-it-works-heading">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How it works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Get started with the simplest freelance time tracker in three easy steps.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Join the Waitlist</h3>
              <p className="text-muted-foreground leading-relaxed">
                Sign up today to secure your spot. We'll notify you as soon as TimeHatch is ready for early access.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Get Early Access</h3>
              <p className="text-muted-foreground leading-relaxed">
                Be among the first to experience TimeHatch. Start tracking your freelance projects immediately.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-4">Track Time & Get Insights</h3>
              <p className="text-muted-foreground leading-relaxed">
                Start tracking work hours, manage projects, and generate reports that help you grow your freelance business.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Built for freelancers who value simplicity
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Skip the complexity of enterprise tools. TimeHatch focuses on what freelancers actually need.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Learning Curve</h3>
                  <p className="text-muted-foreground">Start tracking time immediately. No complex setup or training required for this simple time tracking app.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Professional Reports</h3>
                  <p className="text-muted-foreground">Generate clean, professional reports for clients. Essential freelance productivity tools for billing.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Privacy First</h3>
                  <p className="text-muted-foreground">Your time tracking data stays private and secure. Built for freelancers who value data privacy.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl p-8">
              <div className="text-center">
                <Timer className="w-16 h-16 text-primary mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-foreground mb-4">Ready to track your time?</h3>
                <p className="text-muted-foreground mb-6">
                  Join thousands of freelancers waiting for the best freelance time tracker.
                </p>
                <LeadForm variant="compact" className="max-w-sm mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-muted/20" aria-labelledby="faq-heading">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about TimeHatch time tracking for freelancers.
            </p>
          </div>
          
          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              <AccordionItem value="availability" className="bg-background rounded-lg border border-border px-6">
                <AccordionTrigger className="text-left">
                  When will TimeHatch be available?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Our team is finalizing the TimeHatch platform. Early access for waitlist members begins in Q4 2025, 
                  with a wider rollout planned shortly after. Join the waitlist to be among the first to experience it.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="pricing" className="bg-background rounded-lg border border-border px-6">
                <AccordionTrigger className="text-left">
                  What will TimeHatch cost for early users?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Early users will get special pricing starting at just $9/month for unlimited time tracking, 
                  project management, and reporting. We believe in fair, transparent pricing for freelancers. 
                  No hidden fees or complex tiers.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="privacy" className="bg-background rounded-lg border border-border px-6">
                <AccordionTrigger className="text-left">
                  How do you protect my time tracking data?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Your data privacy is our priority. All time tracking data is encrypted in transit and at rest. 
                  We never share your freelance project information with third parties. You own your data and 
                  can export it anytime.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="features" className="bg-background rounded-lg border border-border px-6">
                <AccordionTrigger className="text-left">
                  Will TimeHatch work for team time tracking?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  While TimeHatch is designed primarily for freelancers, it works great for small teams too. 
                  You can track time across multiple projects and generate team reports. Perfect for agencies 
                  and small businesses that need simple time tracking tools.
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="mobile" className="bg-background rounded-lg border border-border px-6">
                <AccordionTrigger className="text-left">
                  Will there be a mobile app for time tracking?
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  TimeHatch works perfectly in your mobile browser with a responsive design optimized for 
                  freelance productivity on the go. A native mobile app is planned in 2026.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
            Ready for the simplest freelance time tracker?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join 1,000+ freelancers waiting for TimeHatch. Get early access to time tracking tools 
            designed for freelance productivity and project management success.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
            <div className="flex items-center text-muted-foreground">
              <div className="w-2 h-2 bg-accent rounded-full mr-3"></div>
              <span>Track work hours effortlessly</span>
            </div>
            <div className="flex items-center text-muted-foreground">
              <div className="w-2 h-2 bg-accent rounded-full mr-3"></div>
              <span>Professional freelance reports</span>
            </div>
            <div className="flex items-center text-muted-foreground">
              <div className="w-2 h-2 bg-accent rounded-full mr-3"></div>
              <span>No credit card required</span>
            </div>
          </div>
          
          <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
            <a href="#" onClick={(e) => { e.preventDefault(); document.querySelector('form')?.scrollIntoView({ behavior: 'smooth' }); }}>
              Join the Waitlist Now
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 bg-muted/30 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <BrandLogo size="sm" noLink />
              <span className="text-xl font-bold text-foreground">Simple time tracking for freelancers</span>
            </div>
            
            <h3 className="text-2xl font-bold text-foreground mb-4">Coming Soon</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              TimeHatch is the simple time tracking app you've been waiting for. We're building 
              freelance productivity tools that help you track work hours effortlessly and grow your business.
            </p>
            
            <div className="flex flex-wrap justify-center gap-8 mb-8 text-sm">
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/imprint" className="text-muted-foreground hover:text-foreground transition-colors">
                Legal Notice
              </Link>
              <button 
                onClick={openModal}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Cookie Settings
              </button>
              <a href="mailto:hello@timehatch.app" className="text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </a>
            </div>
            
            <div className="border-t border-border/50 pt-6">
              <p className="text-sm text-muted-foreground">
                We respect your privacy. Unsubscribe anytime.
                <br />
                Questions? Email us at{" "}
                <a 
                  href="mailto:hello@timehatch.app" 
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  hello@timehatch.app
                </a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NewLandingPage;