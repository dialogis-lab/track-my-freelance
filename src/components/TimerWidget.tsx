import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
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

export function TimerWidget() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { activeTimer, triggerTimerUpdate } = useTimerContext();
  const { timerSkin } = useTimerSkin();
  const { 
    isEnabled: pomodoroEnabled, 
    setIsEnabled: setPomodoroEnabled, 
    state: pomodoroState,
    loadPomodoroStateFromDatabase
  } = usePomodoro();
  const { toast } = useToast();

  // Sync local state with global timer state
  useEffect(() => {
    if (activeTimer) {
      setSelectedProjectId(activeTimer.project_id);
      setNotes(activeTimer.notes || '');
    } else {
      setElapsedTime(0);
      setNotes('');
    }
  }, [activeTimer]);

  // Load projects
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  // Timer tick effect - only runs when there's an active timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeTimer) {
      interval = setInterval(() => {
        const startTime = new Date(activeTimer.started_at).getTime();
        const now = new Date().getTime();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer]);

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, name, client_id,
        clients:client_id (name)
      `)
      .eq('archived', false)
      .order('name');

    if (error) {
      console.error('Error loading projects:', error);
    } else {
      setProjects(data || []);
    }
  };

  // Remove loadActiveEntry function since it's now handled by TimerContext
  
  const startTimer = async () => {
    if (!selectedProjectId) {
      toast({
        title: "Please select a project",
        description: "You need to select a project before starting the timer.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
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
      toast({
        title: "Error starting timer",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Timer started",
        description: "Time tracking has begun for the selected project.",
      });
      triggerTimerUpdate(); // Trigger dashboard update
    }
    
    setLoading(false);
  };

  const stopTimer = async () => {
    if (!activeTimer) return;

    setLoading(true);
    
    const { error } = await supabase
      .from('time_entries')
      .update({
        stopped_at: new Date().toISOString(),
        notes: notes,
      })
      .eq('id', activeTimer.id);

    if (error) {
      toast({
        title: "Error stopping timer",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setElapsedTime(0);
      setNotes('');
      toast({
        title: "Timer stopped",
        description: "Time entry has been saved successfully.",
      });
      triggerTimerUpdate(); // Trigger dashboard update
    }
    
    setLoading(false);
  };

  const updateNotes = async () => {
    if (!activeTimer) return;

    const { error } = await supabase
      .from('time_entries')
      .update({ notes })
      .eq('id', activeTimer.id);

    if (error) {
      console.error('Error updating notes:', error);
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
                <div className={`timer-digits ${timerSkin === 'gradient' ? 'gradient' : ''} ${showLongRunningWarning ? 'warning' : ''}`}>
                  {formatTimeDisplay(elapsedTime)}
                </div>
              </div>
              
              {/* Active Timer Info */}
              {activeTimer && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <div className="w-2 h-2 bg-primary rounded-full mr-2 animate-pulse" />
                    Running on {activeTimer.projects?.clients?.name ? `${activeTimer.projects.clients.name} - ` : ''}{activeTimer.projects?.name || 'Selected Project'}
                  </div>
                </div>
              )}
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
                disabled={!!activeTimer || loading}
              >
                <SelectTrigger>
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
            <div className="pt-2 space-y-2">
              {!activeTimer ? (
                <Button
                  onClick={startTimer}
                  disabled={loading || !selectedProjectId}
                  size="lg"
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Timer
                </Button>
              ) : (
                <>
                  <Button
                    onClick={stopTimer}
                    disabled={loading}
                    size="lg"
                    variant="destructive"
                    className="w-full"
                  >
                    <Square className="w-4 h-4 mr-2" />
                    Stop Timer
                  </Button>
                  
                  {/* Mobile Focus View Button */}
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/standard-focus'}
                    className="w-full"
                  >
                    📱 Minimal Focus View
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}