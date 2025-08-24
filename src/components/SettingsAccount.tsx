import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User } from 'lucide-react';

export function SettingsAccount() {
  const { user } = useAuth();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <User className="w-5 h-5" />
          <CardTitle>Account Information</CardTitle>
        </div>
        <CardDescription>
          Your account details and profile information.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Email Address</Label>
          <Input value={user?.email || ''} disabled />
        </div>
        
        <div className="space-y-2">
          <Label>User ID</Label>
          <Input value={user?.id || ''} disabled className="font-mono text-xs" />
        </div>

        <div className="space-y-2">
          <Label>Account Created</Label>
          <Input 
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''} 
            disabled 
          />
        </div>
      </CardContent>
    </Card>
  );
}