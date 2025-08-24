import { useCookieConsent } from '@/hooks/useCookieConsent';
import { Button } from '@/components/ui/button';
import { Cookie, Settings } from 'lucide-react';

export function CookieBanner() {
  const { showBanner, acceptAll, rejectNonEssential, openModal } = useCookieConsent();

  console.log('Cookie banner render - showBanner:', showBanner);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-40">
      <div className="max-w-7xl mx-auto p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-start sm:items-center gap-3 flex-1">
            <Cookie className="w-5 h-5 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex-1">
              <p className="text-sm text-foreground leading-relaxed">
                We use cookies to improve your experience and for analytics. You can choose which cookies to allow.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={openModal}
              className="w-full sm:w-auto text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              Customize
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={rejectNonEssential}
              className="w-full sm:w-auto text-xs"
            >
              Reject Non-Essential
            </Button>
            <Button
              size="sm"
              onClick={acceptAll}
              className="w-full sm:w-auto text-xs bg-primary hover:bg-primary/90"
            >
              Accept All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}