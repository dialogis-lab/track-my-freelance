import { Timer, Clock, Users, FileText, BarChart3, Zap, Bell, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LeadForm from "./LeadForm";
import { Link } from "react-router-dom";
import { useCookieContext } from "@/components/CookieProvider";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

const NewLandingPage = () => {
  const { openModal } = useCookieContext();
  const { user } = useAuth();
  const [logoClickCount, setLogoClickCount] = useState(0);

  const handleLogoClick = () => {
    setLogoClickCount(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <header>
        <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between min-h-[3rem]">
              <div className="ml-2">
                <div onClick={handleLogoClick} className="cursor-pointer">
                  <BrandLogo size="md" showWordmark />
                </div>
              </div>
              
              <div className="hidden md:flex items-center space-x-8">
                <a href="#benefits" className="text-muted-foreground hover:text-foreground transition-colors">Benefits</a>
                <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
                <a href="#early-access" className="text-muted-foreground hover:text-foreground transition-colors">Early Access</a>
                
                {/* Hidden login access - shows only after clicking logo 3 times */}
                {logoClickCount >= 3 && (
                  <div className="flex items-center space-x-4 ml-6">
                    <Link to="/login">
                      <Button size="sm" variant="outline">Access Login</Button>
                    </Link>
                  </div>
                )}
              </div>
              
              {/* Mobile menu - hidden login also for mobile */}
              <div className="md:hidden flex items-center space-x-3">
                {logoClickCount >= 3 && (
                  <Link to="/login">
                    <Button size="sm" variant="outline">Login</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="pt-20 pb-32 bg-gradient-to-br from-muted/30 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-4xl mx-auto">
              <div className="mb-6 flex justify-center">
                <div onClick={handleLogoClick} className="cursor-pointer">
                  <BrandLogo size="xl" noLink />
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
                Simple Time Tracking –{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Made Effortless
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground mb-12 leading-relaxed max-w-3xl mx-auto">
                Stay focused, track your projects, and create clean reports – without distractions.
              </p>
              
              <div className="max-w-md mx-auto mb-8">
                <LeadForm variant="hero" />
              </div>
              
              <p className="text-sm text-muted-foreground">
                <Timer className="w-4 h-4 inline mr-2" />
                No spam. Only one email when we launch.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section id="benefits" className="py-20 bg-background" aria-labelledby="benefits-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="benefits-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Why TimeHatch?
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Fast setup – start tracking instantly</h3>
                <p className="text-muted-foreground leading-relaxed">
                  No complex configuration or lengthy onboarding. Create your account and start tracking time within seconds.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-accent/10 to-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <BarChart3 className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Accurate reports – for projects and clients</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Generate professional reports with precise time breakdowns. Perfect for billing clients and analyzing project profitability.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Focus mode – keep it simple, no clutter</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Clean, distraction-free interface designed to help you stay focused on what matters most – your work.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-muted/20" aria-labelledby="how-it-works-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                How TimeHatch Helps You
              </h2>
              <div className="max-w-3xl mx-auto">
                <p className="text-lg text-muted-foreground leading-relaxed">
                  TimeHatch streamlines your workflow with an intuitive process: start a timer with one click, 
                  track your work sessions with optional notes, assign time entries to specific projects and clients, 
                  then export professional reports for billing or analysis. It's designed to be simple and reliable, 
                  so you can focus on your work instead of managing complicated time tracking software.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Early Access Reminder Section */}
        <section id="early-access" className="py-20 bg-background" aria-labelledby="early-access-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="early-access-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Be the First to Try TimeHatch
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Join early adopters and secure a special launch price.
              </p>
              
              <div className="max-w-md mx-auto mb-8">
                <LeadForm variant="hero" />
              </div>
              
              <p className="text-sm text-muted-foreground">
                <Timer className="w-4 h-4 inline mr-2" />
                No spam. Only one email when we launch.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-muted/30 py-16 border-t border-border/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 items-start">
              <div>
                <BrandLogo size="sm" showWordmark className="mb-4" />
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Simple, reliable time tracking for freelancers and small teams. Track your time, grow your business.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-4">Legal</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                      Privacy Policy
                    </Link>
                  </li>
                  <li>
                    <Link to="/imprint" className="text-muted-foreground hover:text-foreground transition-colors">
                      Legal Notice
                    </Link>
                  </li>
                  <li>
                    <button 
                      onClick={openModal} 
                      className="text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      Cookie Settings
                    </button>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-foreground mb-4">Contact</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>hello@timehatch.app</p>
                  <div className="flex space-x-4 mt-4">
                    <div className="w-6 h-6 bg-muted-foreground/20 rounded"></div>
                    <div className="w-6 h-6 bg-muted-foreground/20 rounded"></div>
                    <div className="w-6 h-6 bg-muted-foreground/20 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-border/50 mt-12 pt-8 text-center">
              <p className="text-sm text-muted-foreground">
                © 2025 TimeHatch. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NewLandingPage;