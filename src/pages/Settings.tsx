import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Bell, Clock, User } from 'lucide-react';

interface Reminder {
  id: string;
  cadence: 'daily' | 'weekly';
  hour_local: number;
  enabled: boolean;
}

export default function Settings() {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [reminderForm, setReminderForm] = useState({
    cadence: 'daily' as 'daily' | 'weekly',
    hour_local: 9,
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadReminder();
    }
  }, [user]);

  const loadReminder = async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading reminder:', error);
    } else if (data) {
      setReminder({
        id: data.id,
        cadence: data.cadence as 'daily' | 'weekly',
        hour_local: data.hour_local,
        enabled: data.enabled,
      });
      setReminderForm({
        cadence: data.cadence as 'daily' | 'weekly',
        hour_local: data.hour_local,
        enabled: data.enabled,
      });
    }
  };

  const saveReminder = async () => {
    setLoading(true);

    const reminderData = {
      user_id: user!.id,
      cadence: reminderForm.cadence,
      hour_local: reminderForm.hour_local,
      enabled: reminderForm.enabled,
    };

    let error;
    if (reminder) {
      const { error: updateError } = await supabase
        .from('reminders')
        .update(reminderData)
        .eq('id', reminder.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('reminders')
        .insert([reminderData]);
      error = insertError;
    }

    if (error) {
      toast({
        title: "Error saving reminder settings",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Settings saved",
        description: "Your reminder preferences have been updated.",
      });
      loadReminder();
    }

    setLoading(false);
  };

  const formatHour = (hour: number) => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your account and reminder preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Account Information */}
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

          {/* Reminder Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <CardTitle>Reminder Settings</CardTitle>
              </div>
              <CardDescription>
                Set up email reminders to track your time regularly.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email reminders to track your time
                  </p>
                </div>
                <Switch
                  checked={reminderForm.enabled}
                  onCheckedChange={(checked) =>
                    setReminderForm({ ...reminderForm, enabled: checked })
                  }
                />
              </div>

              {reminderForm.enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={reminderForm.cadence}
                      onValueChange={(value: 'daily' | 'weekly') =>
                        setReminderForm({ ...reminderForm, cadence: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Time of Day</Label>
                    <Select
                      value={reminderForm.hour_local.toString()}
                      onValueChange={(value) =>
                        setReminderForm({ ...reminderForm, hour_local: parseInt(value) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {formatHour(i)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 inline mr-2" />
                      You'll receive {reminderForm.cadence} reminders at {formatHour(reminderForm.hour_local)} (local time)
                    </p>
                  </div>
                </>
              )}

              <Button onClick={saveReminder} disabled={loading} className="w-full">
                Save Reminder Settings
              </Button>
            </CardContent>
          </Card>

          {/* Time Zone Information */}
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
            <CardContent>
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

              <div className="bg-muted/50 rounded-lg p-3 mt-4">
                <p className="text-sm text-muted-foreground">
                  Time zone is automatically detected from your browser. All time entries are stored in UTC and displayed in your local time.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* App Information */}
          <Card>
            <CardHeader>
              <CardTitle>App Information</CardTitle>
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
        </div>
      </div>
    </AppLayout>
  );
}