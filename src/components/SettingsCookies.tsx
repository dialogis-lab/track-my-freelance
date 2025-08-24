import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CookieDebug } from '@/components/CookieDebug';
import { Cookie } from 'lucide-react';

export function SettingsCookies() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Cookie className="w-5 h-5" />
          <CardTitle>Cookie Consent</CardTitle>
        </div>
        <CardDescription>
          Manage your cookie preferences and test the consent system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CookieDebug />
      </CardContent>
    </Card>
  );
}