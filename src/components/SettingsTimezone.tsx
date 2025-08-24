import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock } from 'lucide-react';

export function SettingsTimezone() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5" />
          <CardTitle>Time Zone</CardTitle>
        </div>
        <CardDescription>
          Your current time zone settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Current Time Zone</Label>
          <Input 
            value={Intl.DateTimeFormat().resolvedOptions().timeZone} 
            disabled 
          />
        </div>
        
        <div className="space-y-2">
          <Label>Current Time</Label>
          <Input 
            value={new Date().toLocaleString()} 
            disabled 
          />
        </div>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-sm text-muted-foreground">
            Time zone is automatically detected from your browser. All time entries are stored in UTC and displayed in your local time.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}