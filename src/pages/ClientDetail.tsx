import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, FolderOpen, Clock, TrendingUp, Play, Square, FileText, Edit2 } from 'lucide-react';
import { InvoiceWizard } from '@/components/InvoiceWizard';
import { TrendSparkline } from '@/components/TrendSparkline';
import { formatDuration, calculateDurationMinutes } from '@/lib/timeUtils';

interface Client {
  id: string;
  name: string;
  company_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  address_country?: string;
  vat_id?: string;
  tax_number?: string;
  website?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address_street: '',
    address_city: '',
    address_postal_code: '',
    address_country: '',
    vat_id: '',
    tax_number: '',
    website: '',
    notes: ''
  });
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
      .select(`
        id, name, company_name, contact_person, email, phone,
        address_street, address_city, address_postal_code, address_country,
        vat_id, tax_number, website, notes, created_at, updated_at
      `)
      .eq('id', id)
      .maybeSingle();

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

  const startEdit = () => {
    if (!client) return;
    
    setFormData({
      name: client.name,
      company_name: client.company_name || '',
      contact_person: client.contact_person || '',
      email: client.email || '',
      phone: client.phone || '',
      address_street: client.address_street || '',
      address_city: client.address_city || '',
      address_postal_code: client.address_postal_code || '',
      address_country: client.address_country || '',
      vat_id: client.vat_id || '',
      tax_number: client.tax_number || '',
      website: client.website || '',
      notes: client.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    
    setEditLoading(true);

    const clientData = {
      name: formData.name,
      company_name: formData.company_name || null,
      contact_person: formData.contact_person || null,
      email: formData.email || null,
      phone: formData.phone || null,
      address_street: formData.address_street || null,
      address_city: formData.address_city || null,
      address_postal_code: formData.address_postal_code || null,
      address_country: formData.address_country || null,
      vat_id: formData.vat_id || null,
      tax_number: formData.tax_number || null,
      website: formData.website || null,
      notes: formData.notes || null,
    };

    const { error } = await supabase
      .from('clients')
      .update(clientData)
      .eq('id', client.id);

    if (error) {
      toast({
        title: "Error updating client",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Client updated",
        description: "Client information has been updated successfully.",
      });
      setIsEditDialogOpen(false);
      loadClientData(); // Reload client data
    }

    setEditLoading(false);
  };

  const resetEditForm = () => {
    setIsEditDialogOpen(false);
    setFormData({
      name: '',
      company_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address_street: '',
      address_city: '',
      address_postal_code: '',
      address_country: '',
      vat_id: '',
      tax_number: '',
      website: '',
      notes: ''
    });
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
              <h1 className="text-3xl font-bold text-brand-gradient">{client.name}</h1>
              {client.company_name && (
                <p className="text-xl text-muted-foreground">{client.company_name}</p>
              )}
              <p className="text-muted-foreground">Client overview and project management</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <TrendSparkline clientId={id!} />
            <div className="flex space-x-2">
              <Button variant="outline" onClick={startEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Client
              </Button>
              <Button onClick={() => navigate(`/invoices/new?clientId=${id}`)}>
                <FileText className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
              <Button onClick={handleCreateProject}>
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </div>
          </div>
        </div>

        {/* Client Information Card */}
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-brand-gradient">Client Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Contact Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Contact Details</h3>
                {client.contact_person && (
                  <div>
                    <span className="text-sm text-muted-foreground">Contact Person:</span>
                    <p className="font-medium">{client.contact_person}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <span className="text-sm text-muted-foreground">Email:</span>
                    <p className="font-medium">
                      <a href={`mailto:${client.email}`} className="link-gradient">
                        {client.email}
                      </a>
                    </p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <span className="text-sm text-muted-foreground">Phone:</span>
                    <p className="font-medium">
                      <a href={`tel:${client.phone}`} className="link-gradient">
                        {client.phone}
                      </a>
                    </p>
                  </div>
                )}
                {client.website && (
                  <div>
                    <span className="text-sm text-muted-foreground">Website:</span>
                    <p className="font-medium">
                      <a href={client.website} target="_blank" rel="noopener noreferrer" className="link-gradient">
                        {client.website}
                      </a>
                    </p>
                  </div>
                )}
              </div>

              {/* Address Information */}
              {(client.address_street || client.address_city || client.address_postal_code || client.address_country) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Address</h3>
                  <div>
                    <span className="text-sm text-muted-foreground">Address:</span>
                    <div className="font-medium">
                      {client.address_street && <p>{client.address_street}</p>}
                      {(client.address_postal_code || client.address_city) && (
                        <p>
                          {client.address_postal_code} {client.address_city}
                        </p>
                      )}
                      {client.address_country && <p>{client.address_country}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Tax Information */}
              {(client.vat_id || client.tax_number) && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground">Tax Information</h3>
                  {client.vat_id && (
                    <div>
                      <span className="text-sm text-muted-foreground">VAT ID:</span>
                      <p className="font-medium">{client.vat_id}</p>
                    </div>
                  )}
                  {client.tax_number && (
                    <div>
                      <span className="text-sm text-muted-foreground">Tax Number:</span>
                      <p className="font-medium">{client.tax_number}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            {client.notes && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold text-foreground mb-2">Notes</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

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
        
        {/* Edit Client Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-brand-gradient">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Client Name *</Label>
                    <Input
                      id="edit-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      placeholder="Enter client name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-company_name">Company Name</Label>
                    <Input
                      id="edit-company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      placeholder="Enter company name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contact_person">Contact Person</Label>
                  <Input
                    id="edit-contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Enter contact person name"
                  />
                </div>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-brand-gradient">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="client@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">Phone</Label>
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+49 123 456789"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-website">Website (Optional)</Label>
                  <Input
                    id="edit-website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <Separator />

              {/* Address Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-brand-gradient">Address Information</h3>
                <div className="space-y-2">
                  <Label htmlFor="edit-address_street">Street Address</Label>
                  <Input
                    id="edit-address_street"
                    value={formData.address_street}
                    onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                    placeholder="Musterstraße 123"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-address_city">City</Label>
                    <Input
                      id="edit-address_city"
                      value={formData.address_city}
                      onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                      placeholder="Berlin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address_postal_code">Postal Code</Label>
                    <Input
                      id="edit-address_postal_code"
                      value={formData.address_postal_code}
                      onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
                      placeholder="10115"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address_country">Country</Label>
                    <Input
                      id="edit-address_country"
                      value={formData.address_country}
                      onChange={(e) => setFormData({ ...formData, address_country: e.target.value })}
                      placeholder="Country"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tax Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-brand-gradient">Tax Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-vat_id">VAT ID</Label>
                    <Input
                      id="edit-vat_id"
                      value={formData.vat_id}
                      onChange={(e) => setFormData({ ...formData, vat_id: e.target.value })}
                      placeholder="DE123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-tax_number">Tax Number</Label>
                    <Input
                      id="edit-tax_number"
                      value={formData.tax_number}
                      onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                      placeholder="123/456/78901"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Additional Notes */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-brand-gradient">Additional Notes</h3>
                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes (Optional)</Label>
                  <Textarea
                    id="edit-notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Add any additional notes about this client..."
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button type="submit" disabled={editLoading} variant="gradient">
                  {editLoading ? 'Updating...' : 'Update Client'}
                </Button>
                <Button type="button" variant="outline" onClick={resetEditForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}