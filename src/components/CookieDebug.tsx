import { useCookieContext } from '@/components/CookieProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CookieDebug() {
  const { consent, hasConsented, showBanner, showModal, resetConsent, openModal } = useCookieContext();

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="text-sm">Cookie Consent Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs space-y-1">
          <div>Has Consented: {hasConsented ? 'Yes' : 'No'}</div>
          <div>Show Banner: {showBanner ? 'Yes' : 'No'}</div>
          <div>Show Modal: {showModal ? 'Yes' : 'No'}</div>
          <div>Functional: {consent.functional ? 'Yes' : 'No'}</div>
          <div>Analytics: {consent.analytics ? 'Yes' : 'No'}</div>
          <div>Marketing: {consent.marketing ? 'Yes' : 'No'}</div>
        </div>
        
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openModal}>
            Open Modal
          </Button>
          <Button size="sm" variant="destructive" onClick={resetConsent}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}