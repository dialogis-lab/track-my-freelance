import { Timer, Clock, Users, FileText, BarChart3, Zap, Bell, Shield, DollarSign, Smartphone, Lock, Key, AlertTriangle } from "lucide-react";
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
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div onClick={handleLogoClick} className="cursor-pointer">
              <BrandLogo size="md" showWordmark />
            </div>
          </div>
            
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#security" className="text-muted-foreground hover:text-foreground transition-colors">Security</a>
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
      </header>

      {/* Main Content */}
      <main>
        {/* Hero Section */}
        <section className="pt-12 sm:pt-14 md:pt-16 pb-10 sm:pb-12 md:pb-14 bg-gradient-to-br from-muted/30 to-background">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-4xl mx-auto">
              <div className="hero-logo flex justify-center">
                <div onClick={handleLogoClick} className="cursor-pointer">
                  <img
                    src="/brand/timehatch-hero.svg"
                    alt="TimeHatch - Effortless Time Tracking & Smart Invoicing"
                    className="block h-16 sm:h-20 lg:h-24 w-auto object-contain"
                  />
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-4 leading-tight">
                Effortless Time Tracking &{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Smart Invoicing
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground mt-4 mb-6 leading-relaxed max-w-3xl mx-auto">
                TimeHatch combines a simple timer with client management, invoicing, and reports – all in one secure app.
              </p>
              
              <div className="max-w-lg mx-auto mt-6 sm:mt-7 mb-6">
                <LeadForm variant="hero" className="space-y-6" />
              </div>
              
              <p className="text-sm text-muted-foreground">
                <Timer className="w-4 h-4 inline mr-2" />
                No spam. Just one email when we launch.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-background" aria-labelledby="features-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="features-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Why TimeHatch?
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Timer className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Track Time</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Start, stop, and sync timers across devices – distraction-free with Pomodoro integration and focus tracking.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-accent/10 to-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Manage Projects & Clients</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Organize work, assign time entries, and keep everything in one place with seamless project organization.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <DollarSign className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Create Invoices</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Turn tracked hours into branded PDF invoices with tax calculation and multi-currency support.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-accent/10 to-accent/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <BarChart3 className="w-8 h-8 text-accent" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Gain Insights</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Export reports, view focus stats, and stay on top of your productivity with detailed analytics.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section id="security" className="py-20 bg-muted/20" aria-labelledby="security-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="security-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Built with Security from Day One
              </h2>
              <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                Your data is protected with enterprise-grade security features designed for modern businesses.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-primary/10 to-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Multi-Factor Authentication</h3>
                  <p className="text-muted-foreground text-sm">MFA with Google Authenticator for enhanced account security.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-accent/10 to-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Key className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Recovery Codes & Trusted Devices</h3>
                  <p className="text-muted-foreground text-sm">Secure backup access methods and device management.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-primary/10 to-primary/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Data Encryption & Audit Logging</h3>
                  <p className="text-muted-foreground text-sm">End-to-end encryption with comprehensive security audit trails.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-accent/10 to-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Rate Limiting Protection</h3>
                  <p className="text-muted-foreground text-sm">Advanced protection against brute force attacks and abuse.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-background" aria-labelledby="how-it-works-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                How TimeHatch Works
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl">
                  1
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Start your timer</h3>
                <p className="text-muted-foreground">
                  Click start and begin tracking your work time instantly.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl">
                  2
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Assign tracked time</h3>
                <p className="text-muted-foreground">
                  Organize your time entries by project or client.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl">
                  3
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Generate reports or invoices</h3>
                <p className="text-muted-foreground">
                  Create clean reports or PDF invoices instantly.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-xl">
                  4
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-4">Stay focused & organized</h3>
                <p className="text-muted-foreground">
                  Keep your workflow simple, secure, and productive.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Early Access Reminder Section */}
        <section id="early-access" className="py-20 bg-gradient-to-br from-muted/30 to-background" aria-labelledby="early-access-heading">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 id="early-access-heading" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Be the First to Try TimeHatch
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                Early access, special price, and exclusive updates.
              </p>
              
              <div className="max-w-lg mx-auto mb-8">
                <LeadForm variant="compact" className="space-y-6" />
              </div>
              
              <p className="text-sm text-muted-foreground">
                <Timer className="w-4 h-4 inline mr-2" />
                Early access, special price, and exclusive updates.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid gap-8 sm:grid-cols-3 items-start">
          <div>
            <Link to="/" className="inline-flex items-center gap-2" aria-label="Home">
              <BrandLogo size="sm" showWordmark className="!h-20 sm:!h-24 w-auto" />
            </Link>
            <p className="mt-6 text-sm text-muted-foreground max-w-sm">
              Effortless time tracking and smart invoicing for freelancers and small teams.
            </p>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-foreground">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground hover:underline transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/imprint" className="text-muted-foreground hover:text-foreground hover:underline transition-colors">
                  Imprint
                </Link>
              </li>
              <li>
                <button 
                  onClick={openModal} 
                  className="text-muted-foreground hover:text-foreground hover:underline transition-colors text-left"
                >
                  Cookie Settings
                </button>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-foreground">Contact</h3>
            <div className="mt-3 space-y-3 text-sm">
              <a 
                href="mailto:hello@timehatch.app" 
                className="text-muted-foreground hover:text-foreground hover:underline transition-colors block"
              >
                hello@timehatch.app
              </a>
            </div>
          </div>
        </div>
        
        <div className="border-t">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 text-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} TimeHatch · Made in Switzerland
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NewLandingPage;