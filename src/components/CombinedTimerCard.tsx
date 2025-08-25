import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardTimers } from '@/hooks/useDashboardTimers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, Timer } from 'lucide-react';

export function CombinedTimerCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coupling, setCoupling] = useState(false);
  const [loading, setLoading] = useState(false);
  const notificationPermissionRequested = useRef(false);
  
  const {
    stopwatch,
    pomodoro,
    getStopwatchDisplayTime,
    getPomodoroDisplayTime,
    isStopwatchRunning,
    isPomodoroRunning,
    pomodoroPhase,
    serverOffsetMs
  } = useDashboardTimers();

  // Load coupling default on mount
  useEffect(() => {
    if (user) {
      loadCouplingDefault();
    }
  }, [user]);

  // Request notification permission once if needed
  useEffect(() => {
    if (!notificationPermissionRequested.current && coupling) {
      notificationPermissionRequested.current = true;
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [coupling]);

  // Monitor pomodoro phase changes for alarms
  const prevPhaseRef = useRef<string>();
  useEffect(() => {
    if (pomodoro && prevPhaseRef.current && prevPhaseRef.current !== pomodoro.phase) {
      // Phase ended, play alarm
      playAlarmSound();
      showPhaseNotification(pomodoro.phase);
    }
    prevPhaseRef.current = pomodoro?.phase;
  }, [pomodoro?.phase]);

  const loadCouplingDefault = async () => {
    try {
      const { data } = await supabase
        .from('pomodoro_settings')
        .select('couple_with_stopwatch_default')
        .eq('user_id', user!.id)
        .single();
      
      if (data) {
        setCoupling(data.couple_with_stopwatch_default || false);
      }
    } catch (error) {
      console.error('Error loading coupling default:', error);
    }
  };

  const saveCouplingDefault = async (newCoupling: boolean) => {
    try {
      await supabase.rpc('pomo_get_or_init_settings');
      await supabase
        .from('pomodoro_settings')
        .update({ couple_with_stopwatch_default: newCoupling })
        .eq('user_id', user!.id);
    } catch (error) {
      console.error('Error saving coupling default:', error);
    }
  };

  const handleCouplingChange = async (newCoupling: boolean) => {
    setCoupling(newCoupling);
    await saveCouplingDefault(newCoupling);
    
    // If turning ON while stopwatch is running, start pomodoro
    if (newCoupling && isStopwatchRunning) {
      try {
        await supabase.rpc('pomo_start');
        toast({ title: "Pomodoro coupled", description: "Started Pomodoro session with running timer." });
      } catch (error) {
        console.error('Error starting coupled pomodoro:', error);
      }
    }
  };

  const playAlarmSound = () => {
    try {
      // Create a short beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing alarm sound:', error);
    }
  };

  const showPhaseNotification = (phase: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const phaseLabels = {
        focus: 'Focus Session Complete',
        short_break: 'Short Break Complete',
        long_break: 'Long Break Complete'
      };
      
      new Notification(phaseLabels[phase as keyof typeof phaseLabels] || 'Pomodoro Phase Complete', {
        body: `Time to ${phase === 'focus' ? 'take a break' : 'get back to work'}!`,
        icon: '/icon-192.png'
      });
    }
  };

  const handleStopwatchStart = async () => {
    setLoading(true);
    try {
      // Need a project for stopwatch - this is a simplified version
      // In full implementation, would need project selection
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user!.id)
        .eq('archived', false)
        .limit(1);
      
      if (!projects || projects.length === 0) {
        toast({
          title: "No projects found",
          description: "Create a project first to start time tracking.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('time_entries')
        .insert([{
          user_id: user!.id,
          project_id: projects[0].id,
          started_at: new Date().toISOString(),
          notes: 'Dashboard timer'
        }]);

      if (error) throw error;

      if (coupling) {
        await supabase.rpc('pomo_start');
      }
      
      toast({ title: "Timer started" });
    } catch (error) {
      console.error('Error starting timer:', error);
      toast({ title: "Error starting timer", variant: "destructive" });
    }
    setLoading(false);
  };

  const handleStopwatchStop = async () => {
    if (!stopwatch) return;
    setLoading(true);
    try {
      await supabase
        .from('time_entries')
        .update({ stopped_at: new Date().toISOString() })
        .eq('id', stopwatch.id);

      if (coupling) {
        await supabase.rpc('pomo_stop');
      }
      
      toast({ title: "Timer stopped" });
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast({ title: "Error stopping timer", variant: "destructive" });
    }
    setLoading(false);
  };

  // Format display time for main timer (always stopwatch)
  const formatMainTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format pomodoro remaining time
  const formatPomodoroTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculate pomodoro remaining time
  const getPomodoroRemaining = () => {
    if (!pomodoro || !pomodoro.expected_end_at || pomodoro.status !== 'running') {
      return 0;
    }
    
    const endTime = new Date(pomodoro.expected_end_at).getTime();
    const currentTime = Date.now() + serverOffsetMs;
    return Math.max(0, endTime - currentTime);
  };

  // Get cycle dots display
  const getCycleDots = () => {
    if (!pomodoro) return [];
    const dots = [];
    const cycleCount = 4; // Default long break every 4
    
    for (let i = 0; i < cycleCount; i++) {
      const isActive = i < ((pomodoro as any).cycle_in_round || 0);
      dots.push(
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            isActive ? 'bg-primary' : 'bg-muted'
          }`}
        />
      );
    }
    return dots;
  };

  const mainDisplayTime = getStopwatchDisplayTime();
  const pomodoroRemaining = getPomodoroRemaining();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Timer</span>
          <div className="flex items-center space-x-2">
            <Switch
              id="pomodoro-coupling"
              checked={coupling}
              onCheckedChange={handleCouplingChange}
            />
            <Label htmlFor="pomodoro-coupling" className="text-sm">
              Pomodoro
            </Label>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Timer Display */}
        <div className="text-center">
          <div className="text-6xl font-mono font-bold text-primary">
            {formatMainTime(mainDisplayTime)}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {isStopwatchRunning ? 'Running' : 'Stopped'}
          </div>
        </div>

        {/* Pomodoro Stripe */}
        {coupling && (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <Timer className="w-4 h-4 text-primary" />
              <div>
                <Badge variant="outline" className="text-xs">
                  {pomodoroPhase || 'focus'}
                </Badge>
                <div className="text-sm font-mono">
                  {formatPomodoroTime(pomodoroRemaining)}
                </div>
              </div>
            </div>
            <div className="flex space-x-1">
              {getCycleDots()}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex space-x-2">
          {!isStopwatchRunning ? (
            <Button
              onClick={handleStopwatchStart}
              disabled={loading}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Start
            </Button>
          ) : (
            <Button
              onClick={handleStopwatchStop}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}