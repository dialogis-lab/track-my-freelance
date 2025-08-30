import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MfaSetupCard } from '@/components/MfaSetupCard';
import { Shield } from 'lucide-react';

export function SettingsSecurity() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5" />
          <CardTitle>Two-Factor Authentication</CardTitle>
        </div>
        <CardDescription>
          Add an extra layer of security to your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          <MfaSetupCard />
        </div>
      </CardContent>
    </Card>
  );
}