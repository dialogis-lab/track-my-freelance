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
              <p className="text-sm mb-6">
                <strong>Last updated:</strong> August 24, 2025
              </p>
              <p className="leading-relaxed">
                Timehatch ("we," "our," or "us") is committed to protecting your privacy. This Privacy 
                Policy explains how we collect, use, and safeguard your information when you use our 
                website <a href="https://timehatch.app" className="text-primary hover:text-primary/80 transition-colors">https://timehatch.app</a>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Information We Collect</h2>
              <ul className="list-disc pl-6 space-y-3">
                <li>
                  <strong>Personal Information:</strong> When you join the waitlist, we may collect your name and email address.
                </li>
                <li>
                  <strong>Usage Data:</strong> We automatically collect technical information such as browser type, operating system, and pages visited.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-3">
                <li>To provide early access and updates about Timehatch.</li>
                <li>To improve our website and services.</li>
                <li>To communicate important announcements.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Protection</h2>
              <p className="leading-relaxed">
                We store your personal information securely and do not share it with third parties except as required by law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Cookies</h2>
              <p className="leading-relaxed">
                We may use cookies and similar technologies to improve user experience.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Your Rights</h2>
              <p className="leading-relaxed">
                You may request access, correction, or deletion of your data at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact</h2>
              <p className="leading-relaxed">
                For questions regarding this Privacy Policy, please contact:<br />
                📧 <a 
                  href="mailto:privacy@timehatch.app" 
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  privacy@timehatch.app
                </a>
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;