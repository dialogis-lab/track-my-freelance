import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePomodoro, type PomodoroSettings } from '@/hooks/usePomodoro';
import { Timer, Coffee, Bell, Volume2, Link } from 'lucide-react';

interface CouplingSettings {
  pomodoro_requires_stopwatch: boolean;
  coupling_policy: 'mirror_start' | 'pause_pomo';
}

export function SettingsPomodoroPrefs() {
  const { user } = useAuth();
  const { settings, updateSettings, requestNotificationPermission } = usePomodoro();
  const { toast } = useToast();
  const [localSettings, setLocalSettings] = useState<PomodoroSettings>(settings);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [couplingSettings, setCouplingSettings] = useState<CouplingSettings>({
    pomodoro_requires_stopwatch: true,
    coupling_policy: 'mirror_start'
  });

  useEffect(() => {
    setLocalSettings(settings);
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    loadCouplingSettings();
  }, [settings]);

  const loadCouplingSettings = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('pomodoro_settings')
        .select('pomodoro_requires_stopwatch, coupling_policy')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setCouplingSettings({
          pomodoro_requires_stopwatch: data.pomodoro_requires_stopwatch ?? true,
          coupling_policy: (data.coupling_policy as 'mirror_start' | 'pause_pomo') ?? 'mirror_start'
        });
      }
    } catch (error) {
      console.error('Error loading coupling settings:', error);
    }
  };

  const saveCouplingSettings = async (newSettings: CouplingSettings) => {
    if (!user) return;
    
    try {
      await supabase.rpc('pomo_get_or_init_settings');
      await supabase
        .from('pomodoro_settings')
        .update(newSettings)
        .eq('user_id', user.id);
        
      toast({
        title: "Coupling settings saved",
        description: "Your Pomodoro coupling preferences have been updated.",
      });
    } catch (error) {
      console.error('Error saving coupling settings:', error);
      toast({
        title: "Error saving settings",
        description: "Failed to save coupling settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    updateSettings(localSettings);
    toast({
      title: "Pomodoro settings saved",
      description: "Your preferences have been updated.",
    });
  };

  const handleRequestNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationPermission('granted');
      setLocalSettings(prev => ({ ...prev, notificationsEnabled: true }));
      toast({
        title: "Notifications enabled",
        description: "You'll now receive Pomodoro notifications.",
      });
    } else {
      toast({
        title: "Notifications denied",
        description: "You can enable them later in your browser settings.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof PomodoroSettings, value: number | boolean) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Pomodoro Preferences</h2>
        <p className="text-muted-foreground">
          Configure your Pomodoro timer settings and notifications
        </p>
      </div>

      <div className="grid gap-6">
        {/* Coupling Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="w-5 h-5" />
              Stopwatch Coupling
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Pomodoro requires Stopwatch</Label>
                <p className="text-sm text-muted-foreground">
                  Enforce strict coupling - Pomodoro can never run without a running stopwatch
                </p>
              </div>
              <Switch
                checked={couplingSettings.pomodoro_requires_stopwatch}
                onCheckedChange={(checked) => {
                  const newSettings = { ...couplingSettings, pomodoro_requires_stopwatch: checked };
                  setCouplingSettings(newSettings);
                  saveCouplingSettings(newSettings);
                }}
              />
            </div>
            
            {couplingSettings.pomodoro_requires_stopwatch && (
              <div className="space-y-3">
                <Label>When mismatch occurs</Label>
                <RadioGroup
                  value={couplingSettings.coupling_policy}
                  onValueChange={(value: 'mirror_start' | 'pause_pomo') => {
                    const newSettings = { ...couplingSettings, coupling_policy: value };
                    setCouplingSettings(newSettings);
                    saveCouplingSettings(newSettings);
                  }}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mirror_start" id="mirror_start" />
                    <Label htmlFor="mirror_start" className="flex-1">
                      <div>
                        <div className="font-medium">Start Stopwatch</div>
                        <div className="text-sm text-muted-foreground">
                          If Pomodoro is running but Stopwatch isn't, automatically start the Stopwatch
                        </div>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pause_pomo" id="pause_pomo" />
                    <Label htmlFor="pause_pomo" className="flex-1">
                      <div>
                        <div className="font-medium">Pause Pomodoro</div>
                        <div className="text-sm text-muted-foreground">
                          If Pomodoro is running but Stopwatch isn't, automatically pause the Pomodoro
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Duration Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              Timer Durations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="focusMinutes">Focus Session (minutes)</Label>
                <Input
                  id="focusMinutes"
                  type="number"
                  min="1"
                  max="120"
                  value={localSettings.focusMinutes}
                  onChange={(e) => handleInputChange('focusMinutes', parseInt(e.target.value) || 25)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">Short Break (minutes)</Label>
                <Input
                  id="breakMinutes"
                  type="number"
                  min="1"
                  max="60"
                  value={localSettings.breakMinutes}
                  onChange={(e) => handleInputChange('breakMinutes', parseInt(e.target.value) || 5)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="longBreakMinutes">Long Break (minutes)</Label>
                <Input
                  id="longBreakMinutes"
                  type="number"
                  min="1"
                  max="60"
                  value={localSettings.longBreakMinutes}
                  onChange={(e) => handleInputChange('longBreakMinutes', parseInt(e.target.value) || 15)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="longBreakEvery">Long break every N sessions</Label>
              <Input
                id="longBreakEvery"
                type="number"
                min="2"
                max="10"
                value={localSettings.longBreakEvery}
                onChange={(e) => handleInputChange('longBreakEvery', parseInt(e.target.value) || 4)}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Take a long break every {localSettings.longBreakEvery} focus sessions
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Auto-Start Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="w-5 h-5" />
              Auto-Start Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-start breaks</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically start break timer when focus session ends
                </p>
              </div>
              <Switch
                checked={localSettings.autoStartBreak}
                onCheckedChange={(checked) => handleInputChange('autoStartBreak', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto-start next focus</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically start next focus session when break ends
                </p>
              </div>
              <Switch
                checked={localSettings.autoStartFocus}
                onCheckedChange={(checked) => handleInputChange('autoStartFocus', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notifications & Sounds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications & Sounds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Browser notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show notifications when sessions end
                </p>
              </div>
              <div className="flex items-center gap-2">
                {notificationPermission === 'default' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRequestNotifications}
                  >
                    Enable
                  </Button>
                )}
                <Switch
                  checked={localSettings.notificationsEnabled && notificationPermission === 'granted'}
                  onCheckedChange={(checked) => handleInputChange('notificationsEnabled', checked)}
                  disabled={notificationPermission !== 'granted'}
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4" />
                  Sound alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Play a gentle sound when sessions end
                </p>
              </div>
              <Switch
                checked={localSettings.soundEnabled}
                onCheckedChange={(checked) => handleInputChange('soundEnabled', checked)}
              />
            </div>
            
            {notificationPermission === 'denied' && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">
                  Notifications are blocked. You can enable them in your browser settings for this site.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Presets */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Presets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setLocalSettings(prev => ({
                  ...prev,
                  focusMinutes: 25,
                  breakMinutes: 5,
                  longBreakMinutes: 15
                }))}
              >
                Classic (25/5/15)
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocalSettings(prev => ({
                  ...prev,
                  focusMinutes: 50,
                  breakMinutes: 10,
                  longBreakMinutes: 30
                }))}
              >
                Extended (50/10/30)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave}>
            Save Pomodoro Settings
          </Button>
        </div>
      </div>
    </div>
  );
}