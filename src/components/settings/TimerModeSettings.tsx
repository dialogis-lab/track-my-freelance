import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnifiedTimer, TimerMode } from '@/hooks/useUnifiedTimer';
import { Clock, Timer } from 'lucide-react';

export function TimerModeSettings() {
  const { settings, updateSettings } = useUnifiedTimer();

  const handlePreferredModeChange = (mode: TimerMode) => {
    updateSettings({ preferred_timer_mode: mode });
  };

  const handleAutoStartChange = (enabled: boolean) => {
    updateSettings({ auto_start_on_mode_switch: enabled });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timer Mode Preferences</CardTitle>
        <CardDescription>
          Configure your default timer mode and switching behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="preferred-mode">Default Timer Mode</Label>
          <Select 
            value={settings.preferred_timer_mode} 
            onValueChange={handlePreferredModeChange}
          >
            <SelectTrigger id="preferred-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="stopwatch">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Stopwatch</span>
                </div>
              </SelectItem>
              <SelectItem value="pomodoro">
                <div className="flex items-center space-x-2">
                  <Timer className="w-4 h-4" />
                  <span>Pomodoro</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            This mode will be selected when both timers are inactive
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-start">Auto-start on mode switch</Label>
            <p className="text-sm text-muted-foreground">
              Automatically start the new timer when switching modes while another timer is running
            </p>
          </div>
          <Switch
            id="auto-start"
            checked={settings.auto_start_on_mode_switch}
            onCheckedChange={handleAutoStartChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}