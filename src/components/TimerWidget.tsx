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
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    const secondsInMinute = elapsedTime % 60;
    return (secondsInMinute / 60) * 100;
  };

  const getTimerColorClass = () => {
    if (elapsedTime > 8 * 60 * 60) {
      return "text-destructive";
    }
    return "text-primary";
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold">Time Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timer Display */}
        <div className="relative flex flex-col items-center justify-center py-8">
          {/* Progress Circle Background */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 md:w-56 md:h-56 rounded-full border-4 border-muted/20">
              {/* Progress Circle */}
              <div 
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary/30 transition-all duration-1000 ease-out"
                style={{
                  transform: `rotate(${(getProgressPercentage() * 360) / 100}deg)`
                }}
              />
            </div>
          </div>
          
          {/* Timer Container */}
          <div className="relative z-10 flex flex-col items-center space-y-2">
            {/* Main Timer Display */}
            <div className={`
              font-mono font-bold tracking-wider
              text-4xl sm:text-5xl md:text-6xl lg:text-7xl
              ${getTimerColorClass()}
              drop-shadow-2xl
              transition-all duration-300 ease-out
              ${activeEntry ? 'animate-pulse' : ''}
            `}>
              {formatTimeDisplay(elapsedTime)}
            </div>
            
            {/* Elapsed Time Label */}
            <div className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
              Elapsed Time
            </div>
            
            {/* Gradient Glow Effect */}
            <div className={`
              absolute inset-0 -z-10 blur-3xl opacity-20
              bg-gradient-to-r from-primary to-primary/50
              ${elapsedTime > 8 * 60 * 60 ? 'from-destructive to-destructive/50' : ''}
              transition-colors duration-500
            `} />
          </div>
        </div>

        {/* Long Running Warning */}
        {showLongRunningWarning && (
          <div className="bg-gradient-to-r from-destructive/10 to-orange-500/10 border border-destructive/20 rounded-xl p-4 animate-fade-in">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <p className="text-sm text-destructive font-medium">
                Timer has been running for more than 8 hours. Consider stopping and reviewing your entry.
              </p>
            </div>
          </div>
        )}

        {/* Project Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
            Project
          </label>
          <Select
            value={selectedProjectId}
            onValueChange={setSelectedProjectId}
            disabled={!!activeEntry || loading}
          >
            <SelectTrigger className="h-12 border-2 focus:border-primary transition-colors">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id} className="py-3">
                  {getProjectDisplay(project)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes Section */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
            Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={updateNotes}
            placeholder="What are you working on?"
            rows={3}
            className="border-2 focus:border-primary transition-colors resize-none"
          />
        </div>

        {/* Control Buttons */}
        <div className="pt-2">
          {!activeEntry ? (
            <Button
              onClick={startTimer}
              disabled={loading || !selectedProjectId}
              size="lg"
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Play className="w-5 h-5 mr-3" />
              Start Timer
            </Button>
          ) : (
            <Button
              onClick={stopTimer}
              disabled={loading}
              size="lg"
              variant="destructive"
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-destructive to-destructive/80 hover:from-destructive/90 hover:to-destructive/70 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Square className="w-5 h-5 mr-3" />
              Stop Timer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}