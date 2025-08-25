import { useState } from 'react';
import { useServerPomodoro } from '@/hooks/useServerPomodoro';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Play, Pause, Square, SkipForward, Settings, Timer } from 'lucide-react';

export function PomodoroCard() {
  const {
    session,
    settings,
    displayMs,
    timeRemaining,
    progress,
    isLoading,
    formatTime,
    actions
  } = useServerPomodoro();

  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    focus_ms: 0,
    short_break_ms: 0,
    long_break_ms: 0,
    long_break_every: 0,
    auto_advance: false,
    sound_on: false,
    desktop_notifications: false
  });

  // Initialize settings form when settings load
  if (settings && settingsForm.focus_ms === 0) {
    setSettingsForm({
      focus_ms: settings.focus_ms,
      short_break_ms: settings.short_break_ms,
      long_break_ms: settings.long_break_ms,
      long_break_every: settings.long_break_every,
      auto_advance: settings.auto_advance,
      sound_on: settings.sound_on,
      desktop_notifications: settings.desktop_notifications
    });
  }

  if (isLoading || !session || !settings) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Timer className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading Pomodoro...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSaveSettings = async () => {
    await actions.updateSettings(settingsForm);
    setShowSettings(false);
  };

  const getPrimaryAction = () => {
    if (session.status === 'running') {
      return session.phase === 'focus' ? actions.pause : actions.stop;
    } else if (session.status === 'paused') {
      return actions.resume;
    } else {
      return actions.start;
    }
  };

  const getPrimaryActionText = () => {
    if (session.status === 'running') {
      return session.phase === 'focus' ? 'Pause' : 'End Break';
    } else if (session.status === 'paused') {
      return 'Resume';
    } else {
      return 'Start';
    }
  };

  const getPrimaryActionIcon = () => {
    if (session.status === 'running') {
      return session.phase === 'focus' ? <Pause className="w-4 h-4" /> : <Square className="w-4 h-4" />;
    } else if (session.status === 'paused') {
      return <Play className="w-4 h-4" />;
    } else {
      return <Play className="w-4 h-4" />;
    }
  };

  const getPhaseDisplay = () => {
    switch (session.phase) {
      case 'focus':
        return 'Focus';
      case 'short_break':
        return 'Short Break';
      case 'long_break':
        return 'Long Break';
      default:
        return session.phase;
    }
  };

  const getCycleIndicator = () => {
    const dots = [];
    for (let i = 0; i < settings.long_break_every; i++) {
      const isActive = i < session.cycle_in_round;
      const isCompleted = i < session.phase_index;
      dots.push(
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            isCompleted 
              ? 'bg-primary' 
              : isActive 
                ? 'bg-primary/50' 
                : 'bg-muted-foreground/30'
          }`}
        />
      );
    }
    return dots;
  };

  const progressPercentage = progress * 100;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pomodoro Timer</CardTitle>
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Pomodoro Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="focus-duration">Focus Duration (minutes)</Label>
                  <Input
                    id="focus-duration"
                    type="number"
                    value={Math.round(settingsForm.focus_ms / 60000)}
                    onChange={(e) => setSettingsForm(prev => ({
                      ...prev,
                      focus_ms: parseInt(e.target.value) * 60000
                    }))}
                    min={1}
                    max={120}
                  />
                </div>
                <div>
                  <Label htmlFor="short-break-duration">Short Break Duration (minutes)</Label>
                  <Input
                    id="short-break-duration"
                    type="number"
                    value={Math.round(settingsForm.short_break_ms / 60000)}
                    onChange={(e) => setSettingsForm(prev => ({
                      ...prev,
                      short_break_ms: parseInt(e.target.value) * 60000
                    }))}
                    min={1}
                    max={60}
                  />
                </div>
                <div>
                  <Label htmlFor="long-break-duration">Long Break Duration (minutes)</Label>
                  <Input
                    id="long-break-duration"
                    type="number"
                    value={Math.round(settingsForm.long_break_ms / 60000)}
                    onChange={(e) => setSettingsForm(prev => ({
                      ...prev,
                      long_break_ms: parseInt(e.target.value) * 60000
                    }))}
                    min={1}
                    max={120}
                  />
                </div>
                <div>
                  <Label htmlFor="long-break-every">Long Break Every (focus sessions)</Label>
                  <Input
                    id="long-break-every"
                    type="number"
                    value={settingsForm.long_break_every}
                    onChange={(e) => setSettingsForm(prev => ({
                      ...prev,
                      long_break_every: parseInt(e.target.value)
                    }))}
                    min={2}
                    max={10}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-advance"
                    checked={settingsForm.auto_advance}
                    onCheckedChange={(checked) => setSettingsForm(prev => ({
                      ...prev,
                      auto_advance: checked
                    }))}
                  />
                  <Label htmlFor="auto-advance">Auto-advance to next phase</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sound-on"
                    checked={settingsForm.sound_on}
                    onCheckedChange={(checked) => setSettingsForm(prev => ({
                      ...prev,
                      sound_on: checked
                    }))}
                  />
                  <Label htmlFor="sound-on">Sound notifications</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="desktop-notifications"
                    checked={settingsForm.desktop_notifications}
                    onCheckedChange={(checked) => setSettingsForm(prev => ({
                      ...prev,
                      desktop_notifications: checked
                    }))}
                  />
                  <Label htmlFor="desktop-notifications">Desktop notifications</Label>
                </div>
                <Button onClick={handleSaveSettings} className="w-full">
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Circular Progress Ring */}
        <div className="flex flex-col items-center justify-center py-8">
          <div className="relative">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              {/* Background ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-muted-foreground/20"
              />
              {/* Progress ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={`transition-all duration-1000 ${
                  session.phase === 'focus' 
                    ? 'text-primary' 
                    : 'text-green-500'
                }`}
              />
            </svg>
            
            {/* Timer display in center */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-mono font-bold">
                {formatTime(timeRemaining)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                remaining
              </div>
            </div>
          </div>

          {/* Phase and Status */}
          <div className="flex flex-col items-center space-y-2 mt-4">
            <div className="flex items-center space-x-2">
              <Badge 
                variant={session.phase === 'focus' ? 'default' : 'secondary'}
              >
                {getPhaseDisplay()}
              </Badge>
              <Badge variant="outline">
                {session.status}
              </Badge>
            </div>

            {/* Cycle indicator */}
            <div className="flex items-center space-x-1">
              {getCycleIndicator()}
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="space-y-3">
          <Button
            onClick={getPrimaryAction()}
            size="lg"
            className="w-full"
            variant={session.phase === 'focus' ? 'default' : 'secondary'}
          >
            {getPrimaryActionIcon()}
            {getPrimaryActionText()}
          </Button>

          <div className="flex space-x-2">
            {session.status !== 'stopped' && (
              <Button 
                onClick={actions.stop}
                variant="destructive"
                className="flex-1"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}

            <Button 
              onClick={actions.next}
              variant="outline"
              className="flex-1"
            >
              <SkipForward className="w-4 h-4 mr-2" />
              Skip
            </Button>
          </div>
        </div>

        {/* Server sync indicator */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            ⚡ Synced to server time
          </p>
        </div>
      </CardContent>
    </Card>
  );
}