import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bell, Clock } from 'lucide-react';

interface Reminder {
  id: string;
  cadence: 'daily' | 'weekly';
  hour_local: number;
  enabled: boolean;
}

export function SettingsReminders() {
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [reminderForm, setReminderForm] = useState({
    cadence: 'daily' as 'daily' | 'weekly',
    hour_local: 9,
    enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [originalReminder, setOriginalReminder] = useState<Reminder | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadReminder();
    }
  }, [user]);

  // Check for changes whenever reminderForm changes
  useEffect(() => {
    if (originalReminder) {
      const hasReminderChanges = 
        reminderForm.cadence !== originalReminder.cadence ||
        reminderForm.hour_local !== originalReminder.hour_local ||
        reminderForm.enabled !== originalReminder.enabled;
      
      setHasChanges(hasReminderChanges);
    } else {
      // If no original reminder exists, any non-default values are changes
      setHasChanges(
        reminderForm.cadence !== 'daily' ||
        reminderForm.hour_local !== 9 ||
        reminderForm.enabled !== true
      );
    }
  }, [reminderForm, originalReminder]);

  const loadReminder = async () => {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error loading reminder:', error);
    } else if (data) {
      const reminderData = {
        id: data.id,
        cadence: data.cadence as 'daily' | 'weekly',
        hour_local: data.hour_local,
        enabled: data.enabled,
      };
      
      setReminder(reminderData);
      setOriginalReminder(reminderData); // Store original state
      setReminderForm({
        cadence: data.cadence as 'daily' | 'weekly',
        hour_local: data.hour_local,
        enabled: data.enabled,
      });
    } else {
      // No reminder exists, set defaults
      setOriginalReminder(null);
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
      
      // Update original reminder state
      const newReminderData = {
        id: reminder?.id || 'new',
        cadence: reminderForm.cadence,
        hour_local: reminderForm.hour_local,
        enabled: reminderForm.enabled,
      };
      setOriginalReminder(newReminderData);
      setHasChanges(false);
      
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

        <Button onClick={saveReminder} disabled={loading || !hasChanges} className="w-full">
          {loading ? 'Saving...' : 'Save Reminder Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}