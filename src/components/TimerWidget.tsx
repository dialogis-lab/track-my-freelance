import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Play, Pause, Square } from 'lucide-react';
import { formatTime, hoursToMinutes, calculateDurationMinutes } from '@/lib/timeUtils';

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
  const [activeEntry, setActiveEntry] = useState<ActiveEntry | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Load projects and active entry
  useEffect(() => {
    if (user) {
      loadProjects();
      loadActiveEntry();
    }
  }, [user]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (activeEntry) {
      interval = setInterval(() => {
        const startTime = new Date(activeEntry.started_at).getTime();
        const now = new Date().getTime();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeEntry]);

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

  const loadActiveEntry = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .is('stopped_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading active entry:', error);
    } else if (data) {
      setActiveEntry(data);
      setSelectedProjectId(data.project_id);
      setNotes(data.notes || '');
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
      setActiveEntry(data);
      toast({
        title: "Timer started",
        description: "Time tracking has begun for the selected project.",
      });
    }
    
    setLoading(false);
  };

  const stopTimer = async () => {
    if (!activeEntry) return;

    setLoading(true);
    
    const { error } = await supabase
      .from('time_entries')
      .update({
        stopped_at: new Date().toISOString(),
        notes: notes,
      })
      .eq('id', activeEntry.id);

    if (error) {
      toast({
        title: "Error stopping timer",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setActiveEntry(null);
      setElapsedTime(0);
      setNotes('');
      toast({
        title: "Timer stopped",
        description: "Time entry has been saved successfully.",
      });
    }
    
    setLoading(false);
  };

  const updateNotes = async () => {
    if (!activeEntry) return;

    const { error } = await supabase
      .from('time_entries')
      .update({ notes })
      .eq('id', activeEntry.id);

    if (error) {
      console.error('Error updating notes:', error);
    }
  };

  const formatTimeDisplay = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}h:${minutes.toString().padStart(2, '0')}m:${secs.toString().padStart(2, '0')}s`;
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Time Tracker</span>
          <div className="text-4xl font-mono font-bold text-center py-4 text-primary">
            {formatTimeDisplay(elapsedTime)}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showLongRunningWarning && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive">
              ⚠️ Timer has been running for more than 8 hours. Consider stopping and reviewing your entry.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Project</label>
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
            disabled={!!activeEntry || loading}
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

        <div className="flex space-x-2">
          {!activeEntry ? (
            <Button
              onClick={startTimer}
              disabled={loading || !selectedProjectId}
              className="flex-1"
            >
              <Play className="w-4 h-4 mr-2" />
              Start Timer
            </Button>
          ) : (
            <Button
              onClick={stopTimer}
              disabled={loading}
              variant="destructive"
              className="flex-1"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop Timer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}