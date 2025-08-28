import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { supabase } from '@/integrations/supabase/client';
import { useDashboardTimers } from '@/hooks/useDashboardTimers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Play, Square } from 'lucide-react';

export function CombinedTimerCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { triggerTimerUpdate } = useTimerContext();
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [projects, setProjects] = useState<Array<{id: string, name: string}>>([]);
  
  // Local debug logging
  const debugLog = (message: string, ...args: any[]) => {
    console.log(`[CombinedTimerCard] ${message}`, ...args);
  };
  
  const {
    stopwatch,
    getStopwatchDisplayTime,
    isStopwatchRunning,
    immediateStop,
  } = useDashboardTimers();

  // Load projects on mount
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  // Load project details and notes when a timer is running
  useEffect(() => {
    if (isStopwatchRunning && stopwatch?.id) {
      // Load notes from the current running timer
      loadTimerNotes(stopwatch.id);
    } else if (!isStopwatchRunning) {
      // Clear notes when no timer is running
      setNotes('');
    }
  }, [isStopwatchRunning, stopwatch?.id]);

  const loadTimerNotes = async (timerId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('notes, project_id')
        .eq('id', timerId)
        .single();
      
      if (error) {
        debugLog('Error loading timer notes:', error);
        return;
      }
      
      if (data) {
        setNotes(data.notes || '');
        setSelectedProjectId(data.project_id);
      }
    } catch (error) {
      debugLog('Exception loading timer notes:', error);
    }
  };

  const updateNotesInRunningTimer = async () => {
    if (!stopwatch?.id) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ notes })
        .eq('id', stopwatch.id);

      if (error) {
        debugLog('Error updating notes:', error);
      }
    } catch (error) {
      debugLog('Exception updating notes:', error);
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
      debugLog('Attempting to start timer for project:', selectedProjectId);
      debugLog('Current user:', user?.id);
      debugLog('User object:', user);
      
      // First check if there's already a running timer
      const { data: runningTimer, error: checkError } = await supabase
        .from('time_entries')
        .select('id, project_id, started_at')
        .eq('user_id', user!.id)
        .is('stopped_at', null)
        .limit(1);

      if (checkError) {
        debugLog('Error checking running timer:', checkError);
        console.error('RLS or permission error:', checkError);
        toast({
          title: "Database Error",
          description: `Failed to check existing timers: ${checkError.message}`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      debugLog('Running timer check result:', runningTimer);

      if (runningTimer && runningTimer.length > 0) {
        toast({
          title: "Timer already running",
          description: `A timer is already running. Please stop it first.`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      debugLog('Inserting new timer entry...');
      
      const now = new Date().toISOString();
      const insertData = {
        user_id: user!.id,
        project_id: selectedProjectId,
        started_at: now,
        notes: notes || null
      };
      
      debugLog('Insert data:', insertData);
      
      const { data: timeEntryData, error: timeEntryError } = await supabase
        .from('time_entries')
        .insert([insertData])
        .select()
        .single();

      if (timeEntryError) {
        debugLog('Error inserting timer:', timeEntryError);
        console.error('Timer creation failed:', timeEntryError);
        toast({
          title: "Failed to start timer",
          description: `Error: ${timeEntryError.message}. Code: ${timeEntryError.code}`,
          variant: "destructive"
        });
        setLoading(false);
        return;
      }

      debugLog('Timer started successfully:', timeEntryData);
      toast({ title: "Timer started" });
      
      // Update onboarding state
      try {
        await supabase.functions.invoke('onboarding-state', {
          body: { updates: { timer_started: true } }
        });
      } catch (error) {
        console.error('Error updating onboarding state:', error);
      }
      
      // Trigger dashboard update
      triggerTimerUpdate();
      
      // Don't clear notes or reload - let the real-time updates handle the UI changes
      
    } catch (error) {
      debugLog('Exception starting timer:', error);
      console.error('Unexpected error:', error);
      toast({ 
        title: "Error starting timer", 
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive" 
      });
    }
    setLoading(false);
  };

  const handleStopwatchStop = async () => {
    if (!stopwatch) {
      debugLog('No stopwatch to stop');
      return;
    }
    
    // Immediately stop the UI ticker and disable button
    immediateStop();
    setLoading(true);
    
    try {
      debugLog('Stopping timer:', stopwatch.id);
      
      const { error } = await supabase
        .from('time_entries')
        .update({ stopped_at: new Date().toISOString() })
        .eq('id', stopwatch.id);

      if (error) {
        debugLog('Error stopping timer:', error);
        throw error;
      }

      toast({ title: "Timer stopped" });
      
      // Update onboarding state if notes were added
      try {
        const updates: any = {};
        if (notes && notes.trim()) {
          updates.timer_stopped_with_note = true;
        }
        if (Object.keys(updates).length > 0) {
          await supabase.functions.invoke('onboarding-state', {
            body: { updates }
          });
        }
      } catch (error) {
        console.error('Error updating onboarding state:', error);
      }
      
      // Trigger dashboard update
      triggerTimerUpdate();
      
      // Clear notes after stopping
      setNotes('');
      
    } catch (error) {
      debugLog('Error stopping timer:', error);
      toast({ title: "Error stopping timer", variant: "destructive" });
    }
    setLoading(false);
  };

  // Format display time for main timer
  const formatMainTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const mainDisplayTime = getStopwatchDisplayTime();

  // Debug logging for timer display
  useEffect(() => {
    if (isStopwatchRunning) {
      debugLog('Timer running - display time:', mainDisplayTime, 'formatted:', formatMainTime(mainDisplayTime));
    }
  }, [isStopwatchRunning, mainDisplayTime]);

  return (
    <div className="w-full max-w-3xl">
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="p-5 sm:p-6 pb-4">
          <CardTitle className="flex items-center justify-between">
            <span>Timer</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 pt-0 space-y-6">
          {/* Main Timer Display */}
          <div className="text-center">
            <div className="font-mono font-semibold tracking-wider select-none leading-none text-[clamp(22px,4vw,44px)] bg-gradient-to-r from-blue-500 via-teal-500 to-green-500 bg-clip-text text-transparent">
              {formatMainTime(mainDisplayTime)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {isStopwatchRunning ? 'Running' : 'Stopped'}
            </div>
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project</label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
              disabled={isStopwatchRunning}
            >
              <SelectTrigger className="w-full">
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

          {/* Notes (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={updateNotesInRunningTimer}
                placeholder="What are you working on?"
                className="w-full"
              />
          </div>

          {/* Control Button */}
          <Button
            onClick={isStopwatchRunning ? handleStopwatchStop : handleStopwatchStart}
            disabled={loading || (!selectedProjectId && !isStopwatchRunning)}
            className="w-full"
            size="lg"
            variant={isStopwatchRunning ? "destructive" : "default"}
          >
            {loading ? (
              "Loading..."
            ) : isStopwatchRunning ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Stop Timer
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Start Timer
              </>
            )}
          </Button>

          {/* Debug Info - only show if debug flag is set */}
          {import.meta.env.VITE_TIMER_DEBUG === '1' && (
            <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
              <div>Stopwatch Running: {isStopwatchRunning ? 'YES' : 'NO'}</div>
              <div>Stopwatch Time: {getStopwatchDisplayTime()}ms</div>
            </div>
          )}
      </CardContent>
    </Card>
    </div>
  );
}