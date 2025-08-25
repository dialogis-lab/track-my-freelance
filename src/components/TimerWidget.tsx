import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Play, Pause, Square, Timer, AlertCircle } from 'lucide-react';
import { useTimerSkin } from '@/hooks/useTimerSkin';
import { ModeToggle, TimerMode } from '@/components/ModeToggle';
import { CompactPomodoroDisplay } from '@/components/CompactPomodoroDisplay';
import { PomodoroControls } from '@/components/PomodoroControls';
import { useUnifiedTimer } from '@/hooks/useUnifiedTimer';
import { formatTime } from '@/lib/timeUtils';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  clients?: { name: string } | null;
}

export function TimerWidget() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [clientElapsedTime, setClientElapsedTime] = useState(0);
  
  const { user } = useAuth();
  const { triggerTimerUpdate } = useTimerContext();
  const { timerSkin } = useTimerSkin();
  const { toast } = useToast();
  
  // Use unified timer system
  const unifiedTimer = useUnifiedTimer();
  const timerState = unifiedTimer.getTimerState();
  const isRunning = unifiedTimer.getIsRunning();

  // Smooth client-side timer update for stopwatch mode
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (unifiedTimer.mode === 'stopwatch' && isRunning && timerState.session?.started_at) {
      const startTime = new Date(timerState.session.started_at).getTime();
      
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
  }, [unifiedTimer.mode, isRunning, timerState.session?.started_at]);
  
  // Get display time based on mode
  const getDisplayTime = () => {
    if (unifiedTimer.mode === 'stopwatch') {
      return isRunning ? clientElapsedTime : Math.floor(timerState.displayTime / 1000);
    } else {
      return timerState.pomodoroTimeRemaining || 0;
    }
  };

  // Load projects
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  // Sync form state when active entry changes
  useEffect(() => {
    if (unifiedTimer.mode === 'stopwatch' && timerState.session?.id) {
      loadEntryDetails(timerState.session.id);
    } else if (unifiedTimer.mode === 'stopwatch' && !timerState.session) {
      setNotes('');
    }
  }, [unifiedTimer.mode, timerState.session]);

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

  const startStopwatchTimer = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Please select a project",
        description: "You need to select a project before starting the timer.",
        variant: "destructive",
      });
      return;
    }

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
        console.error('Error starting timer:', error);
        toast({
          title: "Error starting timer",
          description: error.message,
          variant: "destructive",
        });
      } else {
        triggerTimerUpdate();
        toast({
          title: "Timer started",
          description: "Time tracking has begun for the selected project.",
        });
      }
    } catch (err) {
      console.error('Exception starting timer:', err);
      toast({
        title: "Error starting timer",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const stopStopwatchTimer = async () => {
    if (!timerState.session) return;

    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          stopped_at: new Date().toISOString(),
          notes: notes,
        })
        .eq('id', timerState.session.id);

      if (error) {
        console.error('Error stopping timer:', error);
        toast({
          title: "Error stopping timer",
          description: error.message,
          variant: "destructive",
        });
      } else {
        setNotes('');
        triggerTimerUpdate();
        toast({
          title: "Timer stopped",
          description: "Time entry has been saved successfully.",
        });
      }
    } catch (err) {
      console.error('Exception stopping timer:', err);
      toast({
        title: "Error stopping timer",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const updateNotes = async () => {
    if (!timerState.session?.id) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ notes })
        .eq('id', timerState.session.id);

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
  const displayTime = getDisplayTime();
  const showLongRunningWarning = unifiedTimer.mode === 'stopwatch' && displayTime > 8 * 60 * 60;

  if (unifiedTimer.isLoading) {
    return (
      <Card data-skin={timerSkin} className={`timer-skin-${timerSkin}`}>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="text-muted-foreground">Loading timer...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-skin={timerSkin} className={`timer-skin-${timerSkin}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">Time Tracker</CardTitle>
          <ModeToggle
            mode={unifiedTimer.mode}
            onModeChange={unifiedTimer.handleModeChange}
            disabled={loading}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {unifiedTimer.mode === 'pomodoro' ? (
          <>
            {/* Compact Pomodoro Display */}
            <div className="flex flex-col items-center justify-center py-8">
              <div className="timer-display">
                <div 
                  className={`timer-digits ${timerSkin === 'gradient' ? 'gradient' : ''}`}
                  data-testid="timer-display"
                >
                  {formatTimeDisplay(displayTime)}
                </div>
              </div>
            </div>

            <CompactPomodoroDisplay
              phase={timerState.pomodoroPhase || 'focus'}
              timeRemaining={displayTime}
              currentStreak={timerState.currentStreak || 0}
              longBreakEvery={timerState.settings?.longBreakEvery || 4}
              formatTime={formatTimeDisplay}
            />

            <PomodoroControls
              projects={projects}
              selectedProjectId={selectedProjectId}
              onProjectChange={setSelectedProjectId}
            />
          </>
        ) : (
          <>
            {/* Standard Stopwatch Display */}
            <div className="flex flex-col items-center justify-center py-12">
              <div className="timer-display">
                <div 
                  className={`timer-digits ${timerSkin === 'gradient' ? 'gradient' : ''} ${showLongRunningWarning ? 'warning' : ''}`}
                  data-testid="timer-display"
                >
                  {formatTimeDisplay(displayTime)}
                </div>
              </div>
            </div>

            {/* Long Running Warning */}
            {showLongRunningWarning && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
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
                disabled={isRunning || loading}
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
              {!isRunning ? (
                <Button
                  onClick={startStopwatchTimer}
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
                  onClick={stopStopwatchTimer}
                  disabled={loading || !timerState.session}
                  size="lg"
                  variant="destructive"
                  className="w-full"
                  data-testid="stop-timer"
                >
                  <Square className="w-4 h-4 mr-2" />
                  Stop Timer
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}