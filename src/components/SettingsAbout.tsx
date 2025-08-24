import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

export function SettingsAbout() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Info className="w-5 h-5 mr-2" />
          App Information
        </CardTitle>
        <CardDescription>
          About TimeHatch and your data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Version</Label>
          <Input value="1.0.0 MVP" disabled />
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">
            TimeHatch is in MVP mode. Some features may be limited or under development. 
            Your data is securely stored and protected.
          </p>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" asChild className="flex-1">
            <a href="/privacy" target="_blank">Privacy Policy</a>
          </Button>
          <Button variant="outline" asChild className="flex-1">
            <a href="/imprint" target="_blank">Legal Notice</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}