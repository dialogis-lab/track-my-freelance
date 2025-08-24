import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const Imprint = () => {
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
          <h1 className="text-4xl font-bold text-foreground mb-8">Legal Notice</h1>
          
          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Company Information</h2>
              <div className="space-y-2">
                <p><strong>Company:</strong> TimeHatch, Inc.</p>
                <p><strong>Address:</strong> [Company Address]</p>
                <p><strong>City:</strong> [City, State, ZIP]</p>
                <p><strong>Country:</strong> [Country]</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Information</h2>
              <div className="space-y-2">
                <p>
                  <strong>Email:</strong>{" "}
                  <a 
                    href="mailto:legal@timehatch.app" 
                    className="text-primary hover:text-primary/80 transition-colors"
                  >
                    legal@timehatch.app
                  </a>
                </p>
                <p><strong>Phone:</strong> [Phone Number]</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Responsible for Content</h2>
              <p className="leading-relaxed">
                The content of this website is the responsibility of TimeHatch, Inc. 
                We strive to keep all information accurate and up-to-date, but we cannot 
                guarantee the completeness or accuracy of all content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Liability Disclaimer</h2>
              <p className="leading-relaxed">
                Despite careful content control, we assume no liability for the content of 
                external links. The operators of the linked pages are solely responsible 
                for their content.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Copyright</h2>
              <p className="leading-relaxed">
                The content and works on these pages created by the site operator are subject 
                to copyright law. Reproduction, processing, distribution, or any form of 
                commercialization beyond the scope of copyright law requires written consent 
                from the author or creator.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Imprint;