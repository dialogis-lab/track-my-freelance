import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Archive, Edit2, ArchiveRestore, Play, Square, BarChart3, Crown } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { UpgradeModal } from '@/components/UpgradeModal';

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  client_id: string | null;
  rate_hour: number | null;
  archived: boolean;
  created_at: string;
  clients?: { name: string } | null;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    client_id: '',
    rate_hour: ''
  });
  const [loading, setLoading] = useState(false);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { plan, isFree } = usePlan();

  useEffect(() => {
    if (user) {
      loadProjects();
      loadClients();
      checkActiveTimer();
      
      // Handle query parameters for pre-selecting client
      const params = new URLSearchParams(location.search);
      const clientId = params.get('client');
      if (clientId) {
        setFormData(prev => ({ ...prev, client_id: clientId }));
        setIsDialogOpen(true);
      }
    }
  }, [user, location.search]);

  const checkActiveTimer = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select('project_id')
        .eq('user_id', user!.id)
        .is('stopped_at', null)
        .maybeSingle();
      
      if (error) {
        console.error('Error checking active timer:', error);
        setActiveTimer(null);
        return;
      }
      
      if (data) {
        console.log('Active timer found for project:', data.project_id);
        setActiveTimer(data.project_id);
      } else {
        console.log('No active timer found');
        setActiveTimer(null);
      }
    } catch (error) {
      console.error('Error in checkActiveTimer:', error);
      setActiveTimer(null);
    }
  };

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select(`
        id, name, client_id, rate_hour, archived, created_at,
        clients:client_id (name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Error loading projects",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setProjects(data || []);
    }
  };

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name')
      .eq('archived', false)
      .order('name');

    if (error) {
      console.error('Error loading clients:', error);
    } else {
      setClients(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check for Free plan limit only when creating new projects
    if (!editingProject && isFree && activeProjects.length >= 1) {
      setUpgradeModalOpen(true);
      setLoading(false);
      return;
    }

    const projectData = {
      name: formData.name,
      client_id: formData.client_id || null,
      rate_hour: formData.rate_hour ? parseFloat(formData.rate_hour) : null,
      user_id: user!.id,
    };

    // Validate that client is selected
    if (!formData.client_id) {
      toast({
        title: "Client required",
        description: "Please select a client for this project.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    let error;
    if (editingProject) {
      const { error: updateError } = await supabase
        .from('projects')
        .update(projectData)
        .eq('id', editingProject.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('projects')
        .insert([projectData]);
      error = insertError;
    }

    if (error) {
      // Handle specific Free plan limit errors
      if (error.message?.includes('FREE_LIMIT_PROJECTS_REACHED')) {
        setUpgradeModalOpen(true);
        setLoading(false);
        return;
      }
      
      toast({
        title: editingProject ? "Error updating project" : "Error creating project",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: editingProject ? "Project updated" : "Project created",
        description: editingProject ? "Project has been updated successfully." : "New project has been created successfully.",
      });
      resetForm();
      loadProjects();
    }

    setLoading(false);
  };

  const toggleArchive = async (project: Project) => {
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
      loadProjects();
    }
  };

  const resetForm = () => {
    setFormData({ name: '', client_id: '', rate_hour: '' });
    setEditingProject(null);
    setIsDialogOpen(false);
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      client_id: project.client_id || '',
      rate_hour: project.rate_hour ? project.rate_hour.toString() : ''
    });
    setIsDialogOpen(true);
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

    try {
      const { error } = await supabase
        .from('time_entries')
        .update({ stopped_at: new Date().toISOString() })
        .eq('user_id', user!.id)
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
      }
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast({
        title: "Error stopping timer",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCardClick = (projectId: string, event: React.MouseEvent) => {
    // Prevent navigation if clicking on action buttons
    if (event.target !== event.currentTarget && (event.target as HTMLElement).closest('button')) {
      return;
    }
    
    // Navigate to project detail page
    navigate(`/projects/${projectId}`);
  };

  const activeProjects = projects.filter(p => !p.archived);
  const archivedProjects = projects.filter(p => p.archived);

  const handleNewProjectClick = () => {
    if (isFree && activeProjects.length >= 1) {
      setUpgradeModalOpen(true);
      return;
    }
    resetForm();
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projects</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">Manage your projects and hourly rates.</p>
              {isFree && (
                <Badge variant="outline" className="text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Free: {activeProjects.length}/1 project
                </Badge>
              )}
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleNewProjectClick}
                disabled={isFree && activeProjects.length >= 1}
                className={isFree && activeProjects.length >= 1 ? "opacity-50" : ""}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? 'Edit Project' : 'Create New Project'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clients.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No clients available. <span className="underline cursor-pointer" onClick={() => window.open('/clients', '_blank')}>Create a client first</span>.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rate">Hourly Rate (Optional)</Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={formData.rate_hour}
                    onChange={(e) => setFormData({ ...formData, rate_hour: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div className="flex space-x-2">
                  <Button type="submit" disabled={loading || !formData.client_id}>
                    {editingProject ? 'Update' : 'Create'} Project
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <UpgradeModal 
          open={upgradeModalOpen}
          onOpenChange={setUpgradeModalOpen}
          title="Project Limit Reached"
          description="You've reached the Free plan limit of 1 project. Upgrade to create unlimited projects and unlock more features."
        />

        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">Active ({activeProjects.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedProjects.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            {activeProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No active projects yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">Create your first project to start tracking time.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeProjects.map((project) => (
                  <Card 
                    key={project.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={(e) => handleCardClick(project.id, e)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{project.name}</span>
                        <div className="flex space-x-1" onClick={(e) => e.stopPropagation()}>
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(project)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleArchive(project)}
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {project.clients?.name && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Client: {project.clients.name}
                        </p>
                      )}
                      {project.rate_hour && (
                        <p className="text-sm text-muted-foreground">
                          Rate: ${project.rate_hour}/hour
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Created: {new Date(project.created_at).toLocaleDateString('en-US')}
                      </p>
                      
                      {/* Click to view reports hint */}
                      <div className="flex items-center justify-center mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <BarChart3 className="w-3 h-3" />
                          <span>Click to view reports</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="archived" className="space-y-4">
            {archivedProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No archived projects.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedProjects.map((project) => (
                  <Card 
                    key={project.id} 
                    className="opacity-75 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={(e) => handleCardClick(project.id, e)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{project.name}</span>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleArchive(project)}
                          >
                            <ArchiveRestore className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {project.clients?.name && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Client: {project.clients.name}
                        </p>
                      )}
                      {project.rate_hour && (
                        <p className="text-sm text-muted-foreground">
                          Rate: ${project.rate_hour}/hour
                        </p>
                      )}
                      
                      {/* Click to view reports hint */}
                      <div className="flex items-center justify-center mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                          <BarChart3 className="w-3 h-3" />
                          <span>Click to view reports</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}