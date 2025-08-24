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
          <h1 className="text-4xl font-bold text-foreground mb-8">⚖️ Legal Notice (Impressum)</h1>
          
          <div className="space-y-8 text-muted-foreground">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Legal Notice</h2>
              <p className="leading-relaxed mb-4">
                Timehatch.app is operated by:
              </p>
              <div className="bg-muted/30 p-6 rounded-lg space-y-2">
                <p><strong>Company:</strong> Timehatch</p>
                <p><strong>Responsible Person:</strong> Nedjat Nuhi</p>
                <p><strong>Address:</strong> Bahnhoftsrasse 5a, 5210 Windisch, AG - Switzerland</p>
                <p><strong>Email:</strong> <a 
                  href="mailto:contact@timehatch.app" 
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  contact@timehatch.app
                </a></p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Liability for Content</h2>
              <p className="leading-relaxed">
                We make every effort to keep the information on our website accurate and up to date. 
                However, we cannot accept liability for the content provided.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Liability for Links</h2>
              <p className="leading-relaxed">
                Our website contains links to external websites. We have no influence on the content of 
                these third-party websites and therefore accept no liability for them.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Copyright</h2>
              <p className="leading-relaxed">
                All content on this website is subject to copyright. Use, reproduction, or distribution 
                requires written permission.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Imprint;