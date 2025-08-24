import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Error = () => {
  const handleRetry = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container mx-auto px-4 py-16 text-center max-w-2xl">
        <div className="w-20 h-20 bg-gradient-to-r from-destructive/20 to-destructive/30 rounded-full flex items-center justify-center mx-auto mb-8">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
          Something went wrong
        </h1>
        
        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          We couldn't add you to our waitlist right now. 
          This might be a temporary issue on our end.
        </p>
        
        <div className="bg-muted/50 rounded-lg p-6 mb-8">
          <h3 className="font-semibold text-foreground mb-4">Try these steps:</h3>
          <div className="space-y-2 text-sm text-muted-foreground text-left max-w-md mx-auto">
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
              <p>Check your internet connection</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
              <p>Make sure you entered a valid email address</p>
            </div>
            <div className="flex items-start space-x-2">
              <span className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></span>
              <p>Try again in a few minutes</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={handleRetry} className="inline-flex items-center">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          <Link to="/">
            <Button variant="outline" className="inline-flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to TimeHatch
            </Button>
          </Link>
        </div>
        
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground">
            Still having issues? Contact our support team at{" "}
            <a 
              href="mailto:support@timehatch.app" 
              className="text-primary hover:text-primary/80 transition-colors"
            >
              support@timehatch.app
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Error;