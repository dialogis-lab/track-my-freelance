import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { useDashboardTimers } from '@/hooks/useDashboardTimers';
import { useTimerSkin } from '@/hooks/useTimerSkin';
import { usePomodoro } from '@/hooks/usePomodoro';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, Square, Timer } from 'lucide-react';
import { formatTime, hoursToMinutes, calculateDurationMinutes, formatDuration } from '@/lib/timeUtils';
import { PomodoroControls } from '@/components/PomodoroControls';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  clients?: { name: string } | null;
}

interface ActiveEntry {
  id: string;
  project_id: string;
  started_at: string;
  notes: string;
}

export function TimerWidget() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientElapsedTime, setClientElapsedTime] = useState(0); // Client-side timer for smooth display
  const { user } = useAuth();
  const { triggerTimerUpdate } = useTimerContext();
  const { timerSkin } = useTimerSkin();
  const { isEnabled: pomodoroEnabled, setIsEnabled: setPomodoroEnabled, state: pomodoroState } = usePomodoro();
  const { toast } = useToast();
  
  // Use shared timer state from useDashboardTimers
  const { 
    stopwatch: activeEntry,
    getStopwatchDisplayTime,
    isStopwatchRunning
  } = useDashboardTimers();
  
  // Smooth client-side timer update
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isStopwatchRunning && activeEntry?.started_at) {
      const startTime = new Date(activeEntry.started_at).getTime();
      
      // Initialize with current elapsed time
      setClientElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      
      // Update every second for smooth display
      interval = setInterval(() => {
        setClientElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setClientElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStopwatchRunning, activeEntry?.started_at]);
  
  // Use client elapsed time for display, fallback to dashboard time
  const elapsedTime = isStopwatchRunning ? clientElapsedTime : Math.floor(getStopwatchDisplayTime() / 1000);

  // Load projects and sync state with active entry
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  // Sync form state when active entry changes
  useEffect(() => {
    if (activeEntry?.id) {
      // Load full entry details to get project_id and notes
      loadEntryDetails(activeEntry.id);
    } else {
      setNotes('');
      // Keep selectedProjectId for new entries
    }
  }, [activeEntry]);

  const loadEntryDetails = async (entryId: string) => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('project_id, notes')
        .eq('id', entryId)
        .single();

      if (error) {
        console.error('Error loading entry details:', error);
      } else if (data) {
        setSelectedProjectId(data.project_id);
        setNotes(data.notes || '');
      }
    } catch (err) {
      console.error('Exception loading entry details:', err);
    }
  };

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, name, client_id,
        clients:client_id (name)
      `)
      .eq('user_id', user!.id)
      .eq('archived', false)
      .order('name');

    if (error) {
      console.error('Error loading projects:', error);
    } else {
      setProjects(data || []);
    }
  };


  const startTimer = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Please select a project",
        description: "You need to select a project before starting the timer.",
        variant: "destructive",
      });
      return;
    }

    console.log('[TimerWidget] Starting timer for project:', selectedProjectId);
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .insert([{
          user_id: user!.id,
          project_id: selectedProjectId,
          started_at: new Date().toISOString(),
          notes: notes,
        }])
        .select()
        .single();

      if (error) {
        console.error('[TimerWidget] Error starting timer:', error);
        toast({
          title: "Error starting timer",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('[TimerWidget] Timer started successfully:', data);
        triggerTimerUpdate(); // Notify other components
        toast({
          title: "Timer started",
          description: "Time tracking has begun for the selected project.",
        });
      }
    } catch (err) {
      console.error('[TimerWidget] Exception starting timer:', err);
      toast({
        title: "Error starting timer",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const stopTimer = async () => {
    if (!activeEntry) return;

    console.log('[TimerWidget] Stopping timer:', activeEntry.id);
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          stopped_at: new Date().toISOString(),
          notes: notes,
        })
        .eq('id', activeEntry.id);

      if (error) {
        console.error('[TimerWidget] Error stopping timer:', error);
        toast({
          title: "Error stopping timer",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('[TimerWidget] Timer stopped successfully');
        setNotes('');
        triggerTimerUpdate(); // Notify other components
        toast({
          title: "Timer stopped",
          description: "Time entry has been saved successfully.",
        });
      }
    } catch (err) {
      console.error('[TimerWidget] Exception stopping timer:', err);
      toast({
        title: "Error stopping timer",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const updateNotes = async () => {
    if (!activeEntry?.id) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ notes })
        .eq('id', activeEntry.id);

      if (error) {
        console.error('Error updating notes:', error);
      }
    } catch (err) {
      console.error('Exception updating notes:', err);
    }
  };

  const formatTimeDisplay = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  const getProjectDisplay = (project: Project) => {
    if (project.clients?.name) {
      return `${project.clients.name} - ${project.name}`;
    }
    return project.name;
  };

  // Show warning if timer has been running for more than 8 hours
  const showLongRunningWarning = elapsedTime > 8 * 60 * 60;

  return (
    <Card data-skin={timerSkin} className={`timer-skin-${timerSkin}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">Time Tracker</CardTitle>
          <Tabs value={pomodoroEnabled ? 'pomodoro' : 'standard'} onValueChange={(value) => setPomodoroEnabled(value === 'pomodoro')}>
            <TabsList className="grid w-[200px] grid-cols-2">
              <TabsTrigger value="standard">Standard</TabsTrigger>
              <TabsTrigger value="pomodoro">
                <Timer className="w-4 h-4 mr-1" />
                Pomodoro
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {pomodoroEnabled ? (
          <>
            <PomodoroControls
              projects={projects}
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
            />
            
            {/* Minimal Focus View Button */}
            <div className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => window.location.href = '/focus'}
                className="w-full"
                disabled={pomodoroState === 'idle'}
              >
                📱 Minimal Focus View
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Standard Timer Display */}
            <div className="flex flex-col items-center justify-center py-12">
              <div className="timer-display">
                <div 
                  className={`timer-digits ${timerSkin === 'gradient' ? 'gradient' : ''} ${showLongRunningWarning ? 'warning' : ''}`}
                  data-testid="timer-display"
                >
                  {formatTimeDisplay(elapsedTime)}
                </div>
              </div>
            </div>

            {/* Long Running Warning */}
            {showLongRunningWarning && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-destructive rounded-full" />
                  <p className="text-sm text-destructive font-medium">
                    Timer has been running for more than 8 hours. Consider stopping and reviewing your entry.
                  </p>
                </div>
              </div>
            )}

            {/* Project Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={!!activeEntry || loading}
                >
                  <SelectTrigger data-testid="project-select">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {getProjectDisplay(project)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={updateNotes}
                placeholder="What are you working on?"
                rows={3}
              />
            </div>

            {/* Control Buttons */}
            <div className="pt-2">
              {!isStopwatchRunning ? (
                <Button
                  onClick={startTimer}
                  disabled={loading || !selectedProjectId}
                  size="lg"
                  className="w-full"
                  data-testid="start-timer"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Timer
                </Button>
              ) : (
                <Button
                  onClick={stopTimer}
                  disabled={loading || !activeEntry}
                  size="lg"
                  variant="destructive"
                  className="w-full"
                  data-testid="stop-timer"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Timer
                </Button>
              )}
              
              {/* Debug Info for Button State */}
              {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 p-2 bg-yellow-100 rounded text-xs">
                  <div>Active Entry: {activeEntry ? `YES (${activeEntry.id})` : 'NO'}</div>
                  <div>Running: {isStopwatchRunning ? 'YES' : 'NO'}</div>
                  <div>Loading: {loading ? 'YES' : 'NO'}</div>
                  <div>Selected Project: {selectedProjectId || 'NONE'}</div>
                  <div>Display Time: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}</div>
                  <div>Dashboard State: {isStopwatchRunning ? 'RUNNING' : 'STOPPED'}</div>
                  <div>Dashboard Time: {Math.floor(getStopwatchDisplayTime() / 1000 / 60)}:{(Math.floor(getStopwatchDisplayTime() / 1000) % 60).toString().padStart(2, '0')}</div>
                  <div>Button Shows: {(!activeEntry && !isStopwatchRunning) ? 'START' : 'STOP'}</div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}