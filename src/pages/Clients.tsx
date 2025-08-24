import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Archive, Edit2, ArchiveRestore, FolderOpen } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  archived: boolean;
  created_at: string;
  projects?: { id: string; name: string; archived: boolean }[];
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadClients();
    }
  }, [user]);

  const loadClients = async () => {
    const { data, error } = await supabase
      .from('clients')
      .select(`
        id, name, archived, created_at,
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
    } else {
      setClients(data || []);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const clientData = {
      name: clientName,
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
    setClientName('');
    setEditingClient(null);
    setIsDialogOpen(false);
  };

  const startEdit = (client: Client) => {
    setEditingClient(client);
    setClientName(client.name);
    setIsDialogOpen(true);
  };

  const getProjectCount = (client: Client) => {
    if (!client.projects) return 0;
    return client.projects.filter(p => !p.archived).length;
  };

  const activeClients = clients.filter(c => !c.archived);
  const archivedClients = clients.filter(c => c.archived);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clients</h1>
            <p className="text-muted-foreground">Manage your clients and their projects.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                New Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? 'Edit Client' : 'Create New Client'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name</Label>
                  <Input
                    id="name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    placeholder="Enter client name"
                  />
                </div>

                <div className="flex space-x-2">
                  <Button type="submit" disabled={loading}>
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
                  <Card key={client.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="truncate">{client.name}</span>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(client)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleArchive(client)}
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <FolderOpen className="w-4 h-4 text-muted-foreground" />
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
                      
                      {client.projects && client.projects.length > 0 && (
                        <div className="space-y-1">
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
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        Created: {new Date(client.created_at).toLocaleDateString()}
                      </p>
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