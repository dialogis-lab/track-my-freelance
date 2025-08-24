import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus, FolderOpen, Clock, TrendingUp, Play, Square, FileText } from 'lucide-react';
import { InvoiceWizard } from '@/components/InvoiceWizard';
import { formatDuration, calculateDurationMinutes } from '@/lib/timeUtils';

interface Client {
  id: string;
  name: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  rate_hour: number | null;
  archived: boolean;
  created_at: string;
  totalHours: number;
  totalValue: number;
  entriesCount: number;
}

interface ClientStats {
  totalHours: number;
  totalValue: number;
  totalEntries: number;
  activeProjects: number;
  totalProjects: number;
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    totalHours: 0,
    totalValue: 0,
    totalEntries: 0,
    activeProjects: 0,
    totalProjects: 0,
  });
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoiceWizardOpen, setInvoiceWizardOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user && id) {
      loadClientData();
      checkActiveTimer();
    }
  }, [user, id]);

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

  const loadClientData = async () => {
    if (!id) return;

    // Load client info
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (clientError) {
      toast({
        title: "Error loading client",
        description: clientError.message,
        variant: "destructive",
      });
      navigate('/clients');
      return;
    }

    setClient(clientData);

    // Load projects with time entries
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id, name, rate_hour, archived, created_at,
        time_entries!inner (
          started_at, stopped_at
        )
      `)
      .eq('client_id', id)
      .order('created_at', { ascending: false });

    if (projectsError) {
      console.error('Error loading projects:', projectsError);
    }

    // Calculate stats for each project
    const projectsWithStats: Project[] = [];
    let totalStats = {
      totalHours: 0,
      totalValue: 0,
      totalEntries: 0,
      activeProjects: 0,
      totalProjects: 0,
    };

    if (projectsData) {
      for (const project of projectsData) {
        let projectHours = 0;
        let projectEntries = 0;

        // Calculate hours from time entries
        if (project.time_entries) {
          for (const entry of project.time_entries) {
            if (entry.stopped_at) {
              const minutes = calculateDurationMinutes(
                new Date(entry.started_at),
                new Date(entry.stopped_at)
              );
              projectHours += minutes / 60;
              projectEntries++;
            }
          }
        }

        const projectValue = projectHours * (project.rate_hour || 0);

        projectsWithStats.push({
          id: project.id,
          name: project.name,
          rate_hour: project.rate_hour,
          archived: project.archived,
          created_at: project.created_at,
          totalHours: projectHours,
          totalValue: projectValue,
          entriesCount: projectEntries,
        });

        totalStats.totalHours += projectHours;
        totalStats.totalValue += projectValue;
        totalStats.totalEntries += projectEntries;
        totalStats.totalProjects++;
        if (!project.archived) {
          totalStats.activeProjects++;
        }
      }
    }

    // Also load projects without time entries
    const { data: allProjectsData } = await supabase
      .from('projects')
      .select('id, name, rate_hour, archived, created_at')
      .eq('client_id', id);

    if (allProjectsData) {
      for (const project of allProjectsData) {
        if (!projectsWithStats.find(p => p.id === project.id)) {
          projectsWithStats.push({
            id: project.id,
            name: project.name,
            rate_hour: project.rate_hour,
            archived: project.archived,
            created_at: project.created_at,
            totalHours: 0,
            totalValue: 0,
            entriesCount: 0,
          });
          totalStats.totalProjects++;
          if (!project.archived) {
            totalStats.activeProjects++;
          }
        }
      }
    }

    setProjects(projectsWithStats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setStats(totalStats);
    setLoading(false);
  };

  const startTimerForProject = async (projectId: string) => {
    if (activeTimer) {
      toast({
        title: "Timer already running",
        description: "Please stop the current timer before starting a new one.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('time_entries')
      .insert([{
        project_id: projectId,
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
      setActiveTimer(projectId);
      toast({
        title: "Timer started",
        description: "Timer has been started for this project.",
      });
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
      // Reload data to show updated hours
      loadClientData();
    }
  };

  const handleCreateProject = () => {
    navigate(`/projects?client=${id}`);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-6">
          <p>Client not found</p>
        </div>
      </AppLayout>
    );
  }

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/clients')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Clients
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
              <p className="text-muted-foreground">Client overview and project management</p>
            </div>
          </div>
          
          <div className="space-x-2">
            <Button variant="outline" onClick={() => setInvoiceWizardOpen(true)}>
              <FileText className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
            <Button onClick={handleCreateProject}>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(Math.round(stats.totalHours * 60)).normal}</div>
              <div className="text-xs text-muted-foreground">= {formatDuration(Math.round(stats.totalHours * 60)).industrial}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeProjects}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Time Entries</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalEntries}</div>
            </CardContent>
          </Card>
        </div>

        {/* Projects */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Active Projects ({activeProjects.length})</h2>
            {activeProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-2">No projects for this client</p>
                  <p className="text-sm text-muted-foreground mb-4">Create your first project to start tracking time.</p>
                  <Button onClick={handleCreateProject}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Project
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProjects.map((project) => (
                  <Card key={project.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{project.name}</span>
                        <div className="flex space-x-1">
                          {activeTimer === project.id ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={stopTimer}
                            >
                              <Square className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => startTimerForProject(project.id)}
                              disabled={!!activeTimer}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Hours tracked:</span>
                          <div className="text-right">
                            <div className="font-bold">{formatDuration(Math.round(project.totalHours * 60)).normal}</div>
                            <div className="text-xs text-muted-foreground">= {formatDuration(Math.round(project.totalHours * 60)).industrial}h</div>
                          </div>
                        </div>
                        
                        {project.rate_hour && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Value:</span>
                            <span className="font-bold">${project.totalValue.toFixed(2)}</span>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Entries:</span>
                          <Badge variant="secondary">{project.entriesCount}</Badge>
                        </div>
                        
                        {project.rate_hour && (
                          <p className="text-xs text-muted-foreground">
                            Rate: ${project.rate_hour}/hour
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {archivedProjects.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Archived Projects ({archivedProjects.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedProjects.map((project) => (
                  <Card key={project.id} className="opacity-75">
                    <CardHeader>
                      <CardTitle className="truncate">{project.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Hours tracked:</span>
                          <div className="text-right">
                            <div className="font-bold">{formatDuration(Math.round(project.totalHours * 60)).normal}</div>
                            <div className="text-xs text-muted-foreground">= {formatDuration(Math.round(project.totalHours * 60)).industrial}h</div>
                          </div>
                        </div>
                        
                        {project.totalValue > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Value:</span>
                            <span className="font-bold">${project.totalValue.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Invoice Wizard */}
        <InvoiceWizard
          open={invoiceWizardOpen}
          onOpenChange={setInvoiceWizardOpen}
          clientId={id!}
          clientName={client.name}
        />
      </div>
    </AppLayout>
  );
}