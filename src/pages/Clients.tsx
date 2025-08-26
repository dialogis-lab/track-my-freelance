import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Archive, Edit2, ArchiveRestore, FolderOpen, Clock, ExternalLink, Trash2, Crown } from 'lucide-react';
import { formatDuration, calculateDurationMinutes } from '@/lib/timeUtils';
import { usePlan } from '@/hooks/usePlan';
import { UpgradeModal } from '@/components/UpgradeModal';

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
  archived: boolean;
  created_at: string;
  updated_at?: string;
  projects?: { id: string; name: string; archived: boolean }[];
  totalHours?: number;
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
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
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { plan, isFree } = usePlan();

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    const { data: clientsData, error } = await supabase
      .from('clients')
      .select(`
        id, name, company_name, contact_person, email, phone, 
        address_street, address_city, address_postal_code, address_country,
        vat_id, tax_number, website, notes, archived, created_at, updated_at,
        projects:projects!client_id (id, name, archived)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading clients:', error);
      toast({
        title: "Error loading clients",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Calculate total hours for each client
    const clientsWithHours = await Promise.all(
      (clientsData || []).map(async (client) => {
        if (!client.projects || client.projects.length === 0) {
          return { ...client, totalHours: 0 };
        }

        // Get time entries for all projects of this client
        const { data: timeEntries } = await supabase
          .from('time_entries')
          .select('started_at, stopped_at')
          .in('project_id', client.projects.map(p => p.id))
          .not('stopped_at', 'is', null);

        let totalMinutes = 0;
        if (timeEntries) {
          totalMinutes = timeEntries.reduce((total, entry) => {
            return total + calculateDurationMinutes(
              new Date(entry.started_at),
              new Date(entry.stopped_at)
            );
          }, 0);
        }

        return { ...client, totalHours: totalMinutes / 60 };
      })
    );

    setClients(clientsWithHours);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Check for Free plan limit only when creating new clients
    if (!editingClient && isFree && activeClients.length >= 1) {
      setUpgradeModalOpen(true);
      setLoading(false);
      return;
    }

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
      user_id: user!.id,
    };

    let error;
    if (editingClient) {
      const { error: updateError } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', editingClient.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('clients')
        .insert([clientData]);
      error = insertError;
    }

    if (error) {
      toast({
        title: editingClient ? "Error updating client" : "Error creating client",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: editingClient ? "Client updated" : "Client created",
        description: editingClient ? "Client has been updated successfully." : "New client has been created successfully.",
      });
      resetForm();
      loadClients();
    }

    setLoading(false);
  };

  const deleteClient = async (client: Client) => {
    try {
      // Check if client has projects or time entries
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', client.id);

      if (projects && projects.length > 0) {
        // Check for time entries
        const { data: timeEntries } = await supabase
          .from('time_entries')
          .select('id')
          .in('project_id', projects.map(p => p.id));

        if (timeEntries && timeEntries.length > 0) {
          toast({
            title: "Cannot delete client",
            description: "This client has time entries. Archive instead of deleting to preserve data.",
            variant: "destructive",
          });
          return;
        }

        // Delete projects first
        const { error: projectsError } = await supabase
          .from('projects')
          .delete()
          .eq('client_id', client.id);

        if (projectsError) {
          toast({
            title: "Error deleting client",
            description: projectsError.message,
            variant: "destructive",
          });
          return;
        }
      }

      // Delete the client
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) {
        toast({
          title: "Error deleting client",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Client deleted",
          description: "Client has been permanently deleted.",
        });
        loadClients();
      }
    } catch (error: any) {
      toast({
        title: "Error deleting client",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleArchive = async (client: Client) => {
    const { error } = await supabase
      .from('clients')
      .update({ archived: !client.archived })
      .eq('id', client.id);

    if (error) {
      toast({
        title: "Error updating client",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: client.archived ? "Client unarchived" : "Client archived",
        description: client.archived ? "Client has been unarchived." : "Client has been archived.",
      });
      loadClients();
    }
  };

  const resetForm = () => {
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
    setEditingClient(null);
    setIsDialogOpen(false);
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
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
    setIsDialogOpen(true);
  };

  const handleClientClick = (clientId: string) => {
    navigate(`/clients/${clientId}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent, clientId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(`/clients/${clientId}`);
    }
  };

  const getProjectCount = (client: Client) => {
    if (!client.projects) return 0;
    return client.projects.filter(p => !p.archived).length;
  };

  const activeClients = clients.filter(c => !c.archived);
  const archivedClients = clients.filter(c => c.archived);

  const handleNewClientClick = () => {
    if (isFree && activeClients.length >= 1) {
      setUpgradeModalOpen(true);
      return;
    }
    resetForm();
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-brand-gradient">Clients</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-muted-foreground">Manage your clients and their invoicing information.</p>
              {isFree && (
                <Badge variant="outline" className="text-xs">
                  <Crown className="h-3 w-3 mr-1" />
                  Free: {activeClients.length}/1 client
                </Badge>
              )}
            </div>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={handleNewClientClick}
                disabled={isFree && activeClients.length >= 1}
                className={isFree && activeClients.length >= 1 ? "opacity-50" : ""}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Edit Client' : 'Create New Client'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-brand-gradient">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Client Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Enter client name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name</Label>
                      <Input
                        id="company_name"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="Enter company name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Contact Person</Label>
                    <Input
                      id="contact_person"
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
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="client@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+49 123 456789"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website">Website (Optional)</Label>
                    <Input
                      id="website"
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
                    <Label htmlFor="address_street">Street Address</Label>
                    <Input
                      id="address_street"
                      value={formData.address_street}
                      onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                      placeholder="Musterstraße 123"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="address_city">City</Label>
                      <Input
                        id="address_city"
                        value={formData.address_city}
                        onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                        placeholder="Berlin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_postal_code">Postal Code</Label>
                      <Input
                        id="address_postal_code"
                        value={formData.address_postal_code}
                        onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
                        placeholder="10115"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address_country">Country</Label>
                      <Input
                        id="address_country"
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
                      <Label htmlFor="vat_id">VAT ID</Label>
                      <Input
                        id="vat_id"
                        value={formData.vat_id}
                        onChange={(e) => setFormData({ ...formData, vat_id: e.target.value })}
                        placeholder="DE123456789"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax_number">Tax Number</Label>
                      <Input
                        id="tax_number"
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
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add any additional notes about this client..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex space-x-2 pt-4">
                  <Button type="submit" disabled={loading} variant="gradient">
                    {editingClient ? 'Update' : 'Create'} Client
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
          title="Client Limit Reached"
          description="You've reached the Free plan limit of 1 client. Upgrade to create unlimited clients and unlock more features."
        />

        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">Active ({activeClients.length})</TabsTrigger>
            <TabsTrigger value="archived">Archived ({archivedClients.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            {activeClients.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No active clients yet.</p>
                  <p className="text-sm text-muted-foreground mt-2">Create your first client to organize your projects.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeClients.map((client) => (
                  <Card 
                    key={client.id}
                    className="cursor-pointer card-hover transition-smooth group rounded-2xl"
                    onClick={() => handleClientClick(client.id)}
                    onKeyDown={(e) => handleKeyDown(e, client.id)}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for ${client.name}`}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex flex-col items-start">
                          <span className="truncate text-brand-gradient">{client.name}</span>
                          {client.company_name && (
                            <span className="text-sm text-muted-foreground truncate">{client.company_name}</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(client);
                              }}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleArchive(client);
                              }}
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Client</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to permanently delete "{client.name}"? This action cannot be undone.
                                    If the client has time entries, consider archiving instead.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteClient(client)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {client.contact_person && (
                        <div className="mb-2">
                          <span className="text-sm text-muted-foreground">Contact: {client.contact_person}</span>
                        </div>
                      )}
                      
                      {client.email && (
                        <div className="mb-2">
                          <span className="text-xs text-muted-foreground">{client.email}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <FolderOpen className="w-4 h-4 text-brand-gradient" />
                          <span className="text-sm text-muted-foreground">
                            {getProjectCount(client)} projects
                          </span>
                        </div>
                        {getProjectCount(client) > 0 && (
                          <Badge variant="secondary">
                            {getProjectCount(client)}
                          </Badge>
                        )}
                      </div>

                      {client.totalHours !== undefined && client.totalHours > 0 && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Clock className="w-4 h-4 text-brand-gradient" />
                            <span className="text-sm text-muted-foreground">Total hours</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold text-brand-gradient">{formatDuration(Math.round(client.totalHours * 60)).normal}</div>
                            <div className="text-xs text-muted-foreground">= {formatDuration(Math.round(client.totalHours * 60)).industrial}h</div>
                          </div>
                        </div>
                      )}
                      
                      {client.projects && client.projects.length > 0 && (
                        <div className="space-y-1 mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Recent Projects:</p>
                          {client.projects
                            .filter(p => !p.archived)
                            .slice(0, 3)
                            .map((project) => (
                              <p key={project.id} className="text-xs text-muted-foreground truncate">
                                • {project.name}
                              </p>
                            ))}
                          {client.projects.filter(p => !p.archived).length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              +{client.projects.filter(p => !p.archived).length - 3} more
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Created: {new Date(client.created_at).toLocaleDateString('en-US')}</span>
                        {client.vat_id && (
                          <span className="text-xs bg-accent/10 text-accent px-2 py-1 rounded">VAT: {client.vat_id}</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="archived" className="space-y-4">
            {archivedClients.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No archived clients.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedClients.map((client) => (
                  <Card key={client.id} className="opacity-75">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{client.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleArchive(client)}
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2 mb-2">
                        <FolderOpen className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {client.projects?.length || 0} projects
                        </span>
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