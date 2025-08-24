import { CheckCircle, ArrowLeft, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Success = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <div className="w-20 h-20 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-white" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
          Thanks! You're on the list.
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          We'll email you when the TimeHatch beta is ready. 
          You'll be among the first to track time effortlessly.
        </p>
        
        <div className="bg-muted/50 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-center text-muted-foreground mb-4">
            <Clock className="w-5 h-5 mr-2" />
            <span className="font-medium">What happens next?</span>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-semibold">
                1
              </div>
              <p>We're building TimeHatch</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-semibold">
                2
              </div>
              <p>You get early access</p>
            </div>
            <div className="flex flex-col items-center space-y-2">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-semibold">
                3
              </div>
              <p>Track time effortlessly</p>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Want to learn more about what we're building?
          </p>
          
          <Link to="/">
            <Button variant="outline" className="inline-flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to TimeHatch
            </Button>
          </Link>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
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
  );
};

export default Success;