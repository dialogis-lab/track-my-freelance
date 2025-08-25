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
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { user } = useAuth();
  const { triggerTimerUpdate } = useTimerContext();
  const { timerSkin } = useTimerSkin();
  const { toast } = useToast();
  
  // Use unified timer system  
  const unifiedTimer = useUnifiedTimer();
  const timerState = unifiedTimer.getTimerState();
  const isTimerRunning = unifiedTimer.getIsRunning();
  const displayTime = Math.floor(unifiedTimer.getDisplayTime() / 1000);

  // Load projects
  useEffect(() => {
    if (user) {
      loadProjects();
    }
  }, [user]);

  // Sync form state when active entry changes
  useEffect(() => {
    if (timerState.session?.id) {
      loadEntryDetails(timerState.session.id);
    } else {
      setNotes('');
    }
  }, [timerState.session]);

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
        setSelectedProject(data.project_id);
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
    if (!selectedProject) {
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
          project_id: selectedProject,
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
  const isLongRunning = displayTime > 8 * 60 * 60;

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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {!loading && (
          <div className="space-y-4">
            {/* Timer Display */}
            <div className="flex flex-col items-center justify-center py-8">
              <div className={`timer-display timer-skin-${timerSkin}`}>
                <div className={`timer-digits ${timerSkin === 'gradient' ? 'gradient' : ''} ${isLongRunning ? 'warning' : ''}`}>
                  {formatTimeDisplay(displayTime)}
                </div>
              </div>
              
              {/* Subtext with duration */}
              {displayTime > 0 && (
                <div className="timer-subtext-small">
                  = {(displayTime / 3600).toFixed(2)}h
                </div>
              )}
            </div>

            {/* Warning for long running timers */}
            {isLongRunning && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <p className="text-sm text-destructive font-medium">
                    This timer has been running for over 8 hours. Consider taking a break.
                  </p>
                </div>
              </div>
            )}

            {/* Project Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Project</label>
              <Select
                value={selectedProject}
                onValueChange={setSelectedProject}
                disabled={isTimerRunning}
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

            {/* Notes Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="What are you working on? (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={updateNotes}
                rows={3}
                disabled={isTimerRunning}
              />
            </div>

            {/* Timer Controls */}
            <div className="space-y-3">
              <Button
                onClick={isTimerRunning ? stopStopwatchTimer : startStopwatchTimer}
                disabled={!selectedProject && !isTimerRunning}
                size="lg"
                variant={isTimerRunning ? "destructive" : "default"}
                className="w-full"
              >
                {isTimerRunning ? (
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}