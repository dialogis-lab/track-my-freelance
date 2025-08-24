import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Edit2, Archive, ArchiveRestore, Play, Square, BarChart3, Trash2 } from 'lucide-react';
import { TimerWidget } from '@/components/TimerWidget';

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  rate_hour: number | null;
  archived: boolean;
  created_at: string;
  clients?: { 
    id: string;
    name: string; 
  } | null;
}

interface TimeEntry {
  id: string;
  started_at: string;
  stopped_at: string | null;
  created_at: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { timerUpdated } = useTimerContext();
  const [project, setProject] = useState<Project | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);

  useEffect(() => {
    if (user && id) {
      loadProjectData();
      checkActiveTimer();
    }
  }, [user, id]);

  // Listen for timer updates from TimerWidget
  useEffect(() => {
    if (user && id && timerUpdated > 0) {
      loadProjectData();
      checkActiveTimer();
    }
  }, [user, id, timerUpdated]);

  const checkActiveTimer = async () => {
    const { data } = await supabase
      .from('time_entries')
      .select('project_id')
      .is('stopped_at', null)
      .single();
    
    if (data) {
      setActiveTimer(data.project_id);
    }
  };

  const loadProjectData = async () => {
    setLoading(true);
    
    // Load project details
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select(`
        id, name, client_id, rate_hour, archived, created_at,
        clients:client_id (id, name)
      `)
      .eq('id', id)
      .single();

    if (projectError) {
      toast({
        title: "Error loading project",
        description: projectError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setProject(projectData);

    // Load recent time entries
    const { data: entriesData, error: entriesError } = await supabase
      .from('time_entries')
      .select('id, started_at, stopped_at, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (entriesError) {
      toast({
        title: "Error loading time entries",
        description: entriesError.message,
        variant: "destructive",
      });
    } else {
      setTimeEntries(entriesData || []);
    }

    setLoading(false);
  };

  const toggleArchive = async () => {
    if (!project) return;

    const { error } = await supabase
      .from('projects')
      .update({ archived: !project.archived })
      .eq('id', project.id);

    if (error) {
      toast({
        title: "Error updating project",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: project.archived ? "Project unarchived" : "Project archived",
        description: project.archived ? "Project has been unarchived." : "Project has been archived.",
      });
      setProject({ ...project, archived: !project.archived });
    }
  };

  const startTimerForProject = async () => {
    if (!project || activeTimer) {
      if (activeTimer) {
        toast({
          title: "Timer already running",
          description: "Please stop the current timer before starting a new one.",
          variant: "destructive",
        });
      }
      return;
    }

    const { error } = await supabase
      .from('time_entries')
      .insert([{
        project_id: project.id,
        user_id: user!.id,
        started_at: new Date().toISOString()
      }]);

    if (error) {
      toast({
        title: "Error starting timer",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setActiveTimer(project.id);
      toast({
        title: "Timer started",
        description: "Timer has been started for this project.",
      });
      loadProjectData(); // Refresh data
    }
  };

  const stopTimer = async () => {
    if (!activeTimer) return;

    const { error } = await supabase
      .from('time_entries')
      .update({ stopped_at: new Date().toISOString() })
      .is('stopped_at', null)
      .eq('project_id', activeTimer);

    if (error) {
      toast({
        title: "Error stopping timer",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setActiveTimer(null);
      toast({
        title: "Timer stopped",
        description: "Timer has been stopped.",
      });
      loadProjectData(); // Refresh data
    }
  };

  const formatDuration = (started: string, stopped: string | null) => {
    const start = new Date(started);
    const end = stopped ? new Date(stopped) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const deleteTimeEntry = async (entry: TimeEntry) => {
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entry.id);

      if (error) {
        toast({
          title: "Error deleting time entry",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Time entry deleted",
          description: "Time entry has been permanently deleted.",
        });
        loadProjectData(); // Refresh data
        
        // If we deleted the running timer, update activeTimer state
        if (!entry.stopped_at && activeTimer === project?.id) {
          setActiveTimer(null);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error deleting time entry",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Project not found</h1>
          <Button onClick={() => navigate('/projects')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/projects')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                {project.name}
                {project.archived && <Badge variant="secondary">Archived</Badge>}
              </h1>
              {project.clients && (
                <p className="text-muted-foreground">
                  Client: {project.clients.name}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex space-x-2">
            {activeTimer === project.id ? (
              <Button variant="destructive" onClick={stopTimer}>
                <Square className="w-4 h-4 mr-2" />
                Stop Timer
              </Button>
            ) : (
              <Button 
                onClick={startTimerForProject}
                disabled={!!activeTimer || project.archived}
              >
                <Play className="w-4 h-4 mr-2" />
                Start Timer
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={() => navigate(`/reports?project=${project.id}`)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              View Reports
            </Button>
            
            <Button variant="outline" onClick={() => navigate('/projects')}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Project
            </Button>
            
            <Button variant="outline" onClick={toggleArchive}>
              {project.archived ? (
                <>
                  <ArchiveRestore className="w-4 h-4 mr-2" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Project Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <p>{new Date(project.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Hourly Rate:</span>
                      <p>{project.rate_hour ? `$${project.rate_hour}/hour` : 'Not set'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Time Entries</CardTitle>
              </CardHeader>
              <CardContent>
                {timeEntries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No time entries yet. Start tracking time to see entries here.
                  </p>
                ) : (
                  <div className="space-y-3">
                     {timeEntries.map((entry) => (
                       <div key={entry.id} className="flex justify-between items-center p-3 border border-border rounded-lg">
                         <div className="flex-1">
                           <p className="font-medium">
                             {new Date(entry.started_at).toLocaleDateString()}
                           </p>
                           <p className="text-sm text-muted-foreground">
                             {new Date(entry.started_at).toLocaleTimeString()} - {' '}
                             {entry.stopped_at ? new Date(entry.stopped_at).toLocaleTimeString() : 'Running'}
                           </p>
                         </div>
                         <div className="flex items-center space-x-3">
                           <div className="text-right">
                             <p className="font-medium">
                               {formatDuration(entry.started_at, entry.stopped_at)}
                             </p>
                             {!entry.stopped_at && (
                               <Badge variant="default" className="text-xs">
                                 Running
                               </Badge>
                             )}
                           </div>
                           <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="sm">
                                 <Trash2 className="w-4 h-4 text-destructive" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>Delete Time Entry</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   Are you sure you want to permanently delete this time entry from {new Date(entry.started_at).toLocaleDateString()}? 
                                   This action cannot be undone.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                                 <AlertDialogAction
                                   onClick={() => deleteTimeEntry(entry)}
                                   className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                 >
                                   Delete
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         </div>
                       </div>
                     ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Timer</CardTitle>
              </CardHeader>
              <CardContent>
                <TimerWidget />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}