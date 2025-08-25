import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardTimers } from '@/hooks/useDashboardTimers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, Timer } from 'lucide-react';

export function CombinedTimerCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [coupling, setCoupling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
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

  // Load coupling default and projects on mount
  useEffect(() => {
    if (user) {
      loadCouplingDefault();
      loadProjects();
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

  // Monitor pomodoro phase changes for alarms and timer control
  const prevPhaseRef = useRef<string>();
  const prevStatusRef = useRef<string>();
  useEffect(() => {
    if (pomodoro && coupling) {
      // Check for phase changes
      if (prevPhaseRef.current && prevPhaseRef.current !== pomodoro.phase) {
        // Phase ended, play alarm and show notification
        playAlarmSound();
        showPhaseNotification(pomodoro.phase, prevPhaseRef.current);
        
        // If we just finished a focus phase, stop the main timer
        if (prevPhaseRef.current === 'focus') {
          handleStopwatchStop();
        }
      }
      
      // Check for status changes (running to stopped/completed)
      if (prevStatusRef.current === 'running' && 
          (pomodoro.status === 'stopped' || pomodoro.status === 'completed')) {
        // Pomodoro session ended, play alarm
        playAlarmSound();
        showPhaseNotification('session_complete', prevStatusRef.current);
        
        // Stop main timer if it's running
        if (isStopwatchRunning) {
          handleStopwatchStop();
        }
      }
    }
    
    prevPhaseRef.current = pomodoro?.phase;
    prevStatusRef.current = pomodoro?.status;
  }, [pomodoro?.phase, pomodoro?.status, coupling, isStopwatchRunning]);

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

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('user_id', user!.id)
        .eq('archived', false)
        .order('name');
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setProjects(data);
        if (!selectedProjectId) {
          setSelectedProjectId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading projects:', error);
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

  const showPhaseNotification = (phase: string, previousPhase?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      let title = '';
      let body = '';
      
      if (phase === 'session_complete') {
        title = 'Pomodoro Session Complete';
        body = 'Great work! Your Pomodoro session is finished.';
      } else if (previousPhase === 'focus') {
        // Just finished a focus session
        title = 'Focus Session Complete';
        body = phase === 'short_break' ? 'Time for a short break!' : 'Time for a long break!';
      } else if (previousPhase === 'short_break' || previousPhase === 'long_break') {
        // Just finished a break
        title = 'Break Complete';
        body = 'Break time is over - ready to focus?';
      } else {
        // Fallback
        const phaseLabels = {
          focus: 'Focus Session',
          short_break: 'Short Break', 
          long_break: 'Long Break'
        };
        title = `${phaseLabels[phase as keyof typeof phaseLabels] || 'Pomodoro'} Started`;
        body = `${phase.replace('_', ' ')} phase has begun.`;
      }
      
      new Notification(title, {
        body,
        icon: '/icon-192.png'
      });
    }
  };

  const handleStopwatchStart = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Please select a project",
        description: "You need to select a project to start time tracking.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // First check if there's already a running timer
      const { data: runningTimer } = await supabase
        .from('time_entries')
        .select('id')
        .eq('user_id', user!.id)
        .is('stopped_at', null)
        .limit(1);

      if (runningTimer && runningTimer.length > 0) {
        toast({
          title: "Timer already running",
          description: "Please stop the current timer first.",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from('time_entries')
        .insert([{
          user_id: user!.id,
          project_id: selectedProjectId,
          started_at: new Date().toISOString(),
          notes: notes || null
        }]);

      if (error) throw error;

      if (coupling) {
        // Start Pomodoro with fresh session to use current settings
        await supabase.rpc('pomo_start');
        toast({ title: "Timer started", description: "Pomodoro session is now running with your timer." });
      } else {
        toast({ title: "Timer started" });
      }
      
      // Clear notes after starting
      setNotes('');
    } catch (error) {
      console.error('Error starting timer:', error);
      toast({ 
        title: "Error starting timer", 
        description: error.message || "Please try again",
        variant: "destructive" 
      });
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

      if (coupling && isPomodoroRunning) {
        await supabase.rpc('pomo_stop');
        toast({ title: "Timer stopped", description: "Both timer and Pomodoro session stopped." });
      } else {
        toast({ title: "Timer stopped" });
      }
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
                <div className="flex items-center space-x-2">
                  <Badge variant={isPomodoroRunning ? "default" : "outline"} className="text-xs">
                    {pomodoroPhase === 'focus' ? 'Focus' : 
                     pomodoroPhase === 'short_break' ? 'Short Break' : 
                     pomodoroPhase === 'long_break' ? 'Long Break' : 'Focus'}
                  </Badge>
                  {isPomodoroRunning && (
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </div>
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

        {/* Project Selection and Notes (only when timer is not running) */}
        {!isStopwatchRunning && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="project-select" className="text-sm font-medium">
                Project
              </Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="notes-input" className="text-sm font-medium">
                Notes (optional)
              </Label>
              <Input
                id="notes-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What are you working on?"
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Control Buttons */}
        <div className="flex space-x-2">
          {!isStopwatchRunning ? (
            <Button
              onClick={handleStopwatchStart}
              disabled={loading || projects.length === 0}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Timer
            </Button>
          ) : (
            <Button
              onClick={handleStopwatchStop}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Timer
            </Button>
          )}
        </div>

        {/* Show help text if no projects */}
        {projects.length === 0 && (
          <div className="text-sm text-muted-foreground text-center">
            <a href="/projects" className="text-primary hover:underline">
              Create a project
            </a> to start time tracking
          </div>
        )}
      </CardContent>
    </Card>
  );
}