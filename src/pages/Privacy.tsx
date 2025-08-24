import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Link 
          to="/" 
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to TimeHatch
        </Link>
        
        <div className="prose prose-gray max-w-none">
          <h1 className="text-4xl font-bold text-foreground mb-8">Privacy Policy</h1>
          
          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Information We Collect</h2>
              <p className="leading-relaxed">
                When you join our waitlist, we collect your email address and optionally your name. 
                We also collect technical information such as your IP address, browser type, and 
                referring website to help us understand how you found TimeHatch.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">How We Use Your Information</h2>
              <p className="leading-relaxed mb-4">We use your information to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Notify you when TimeHatch becomes available</li>
                <li>Send you updates about our product development</li>
                <li>Provide customer support when needed</li>
                <li>Improve our marketing and product offerings</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Protection</h2>
              <p className="leading-relaxed">
                We take the security of your personal information seriously. Your data is encrypted 
                in transit and at rest. We never sell your information to third parties and only 
                share it with trusted service providers who help us operate our waitlist.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Your Rights</h2>
              <p className="leading-relaxed mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Unsubscribe from our communications at any time</li>
                <li>Request a copy of the data we have about you</li>
                <li>Request deletion of your personal information</li>
                <li>Correct any inaccurate information we have</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="leading-relaxed">
                If you have any questions about this Privacy Policy or how we handle your data, 
                please contact us at{" "}
                <a 
                  href="mailto:privacy@timehatch.app" 
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  privacy@timehatch.app
                </a>
              </p>
            </section>

            <section className="pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                This Privacy Policy was last updated on {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;