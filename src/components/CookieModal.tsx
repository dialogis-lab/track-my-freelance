import { useEffect, useRef } from 'react';
import { useCookieConsent } from '@/hooks/useCookieConsent';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

export function CookieModal() {
  const { consent, showModal, updateConsent, closeModal } = useCookieConsent();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  console.log('Cookie modal render - showModal:', showModal);

  // Focus trap and ESC key handling
  useEffect(() => {
    if (!showModal) return;

    const modal = modalRef.current;
    if (!modal) return;

    // Focus the close button when modal opens
    if (closeButtonRef.current) {
      closeButtonRef.current.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      // Focus trap
      if (e.key === 'Tab') {
        const focusableElements = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showModal, closeModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  if (!showModal) return null;

  const handleSavePreferences = () => {
    updateConsent(consent);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && closeModal()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto relative z-51"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 id="cookie-modal-title" className="text-lg font-semibold text-foreground">
              Cookie Settings
            </h2>
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="sm"
              onClick={closeModal}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close cookie settings"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-6">
            Choose which cookies you'd like to allow. You can change these settings at any time.
          </p>

          <div className="space-y-4">
            {/* Functional Cookies */}
            <div className="flex items-start space-x-3 p-4 border border-border rounded-lg bg-muted/20">
              <Checkbox
                id="functional"
                checked={true}
                disabled={true}
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="functional" className="font-medium text-foreground">
                  Functional Cookies
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Essential for the website to function properly. These cannot be disabled.
                </p>
              </div>
            </div>

            {/* Analytics Cookies */}
            <div className="flex items-start space-x-3 p-4 border border-border rounded-lg">
              <Checkbox
                id="analytics"
                checked={consent.analytics}
                onCheckedChange={(checked) =>
                  updateConsent({ analytics: checked === true })
                }
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="analytics" className="font-medium text-foreground cursor-pointer">
                  Analytics Cookies
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Help us understand how visitors interact with our website by collecting anonymous information.
                </p>
              </div>
            </div>

            {/* Marketing Cookies */}
            <div className="flex items-start space-x-3 p-4 border border-border rounded-lg">
              <Checkbox
                id="marketing"
                checked={consent.marketing}
                onCheckedChange={(checked) =>
                  updateConsent({ marketing: checked === true })
                }
                className="mt-1"
              />
              <div className="flex-1">
                <Label htmlFor="marketing" className="font-medium text-foreground cursor-pointer">
                  Marketing Cookies
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Used to deliver personalized advertisements and track their effectiveness. (Not currently used)
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              onClick={handleSavePreferences}
              className="flex-1"
            >
              Save Preferences
            </Button>
            <Button
              variant="outline"
              onClick={closeModal}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}