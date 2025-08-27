import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ArrowRight, Save, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDuration, calculateDurationMinutes } from '@/lib/timeUtils';
import { formatMoney, Currency, CURRENCIES, toMinor } from '@/lib/currencyUtils';
import type { InvoiceLineItem } from '@/types/invoice';

interface Client {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  rate_hour: number | null;
  client_id: string;
}

interface TimeEntry {
  id: string;
  started_at: string;
  stopped_at: string | null;
  project_id: string;
  projects: {
    name: string;
    rate_hour: number | null;
  };
}

export default function InvoiceNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [step, setStep] = useState<'setup' | 'preview'>('setup');
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(searchParams.get('clientId') || '');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [currency, setCurrency] = useState<Currency>('USD');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadClients();
      loadCurrency();
    }
  }, [user]);

  useEffect(() => {
    if (selectedClientId) {
      loadProjectsForClient(selectedClientId);
    }
  }, [selectedClientId]);

  const loadCurrency = () => {
    const stored = localStorage.getItem('timehatch-currency');
    if (stored && CURRENCIES.includes(stored as Currency)) {
      setCurrency(stored as Currency);
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
      return;
    }

    setClients(data || []);
  };

  const loadProjectsForClient = async (clientId: string) => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, rate_hour, client_id')
      .eq('client_id', clientId)
      .eq('archived', false)
      .order('name');

    if (error) {
      console.error('Error loading projects:', error);
      return;
    }

    setProjects(data || []);
  };

  const generatePreview = async () => {
    if (!selectedClientId || selectedProjectIds.length === 0) {
      toast({
        title: "Missing information",
        description: "Please select a client and at least one project.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Fetch time entries for selected projects within date range
      const { data: timeEntries, error } = await supabase
        .from('time_entries')
        .select(`
          id, started_at, stopped_at, project_id,
          projects!inner (name, rate_hour)
        `)
        .in('project_id', selectedProjectIds)
        .gte('started_at', dateRange.start)
        .lte('started_at', dateRange.end + 'T23:59:59')
        .not('stopped_at', 'is', null) as { data: TimeEntry[] | null, error: any };

      if (error) {
        throw error;
      }

      // Group by project and calculate totals
      const projectTotals: Record<string, InvoiceLineItem> = {};

      for (const entry of timeEntries || []) {
        const projectId = entry.project_id;
        const projectName = entry.projects.name;
        const ratePerHour = entry.projects.rate_hour || 0;

        if (!projectTotals[projectId]) {
          projectTotals[projectId] = {
            project_id: projectId,
            project_name: projectName,
            minutes: 0,
            rate_minor: toMinor(ratePerHour, currency),
            amount_minor: 0,
          };
        }

        const minutes = calculateDurationMinutes(
          new Date(entry.started_at),
          new Date(entry.stopped_at!)
        );

        projectTotals[projectId].minutes += minutes;
        projectTotals[projectId].amount_minor = Math.round(
          (projectTotals[projectId].minutes / 60) * projectTotals[projectId].rate_minor
        );
      }

      setLineItems(Object.values(projectTotals));
      setStep('preview');
    } catch (error: any) {
      toast({
        title: "Error generating preview",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveInvoice = async () => {
    if (lineItems.length === 0) {
      toast({
        title: "No items to invoice",
        description: "Please select a date range with tracked time.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const totalMinor = lineItems.reduce((sum, item) => sum + item.amount_minor, 0);

      // Generate invoice number automatically
      const { data: invoiceNumber, error: numberError } = await supabase.rpc('generate_invoice_number');
      
      if (numberError) {
        console.error('Error generating invoice number:', numberError);
        // Continue without a number - user can generate it later
      }

      // Create invoice with generated number
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: user!.id,
          client_id: selectedClientId,
          project_ids: selectedProjectIds,
          currency,
          total_minor: totalMinor,
          status: 'draft',
          number: invoiceNumber, // Automatically generated number
        })
        .select()
        .single();

      if (invoiceError) {
        throw invoiceError;
      }

      // Create invoice items
      const invoiceItems = lineItems.map(item => ({
        invoice_id: invoice.id,
        project_id: item.project_id,
        minutes: item.minutes,
        rate_minor: item.rate_minor,
        amount_minor: item.amount_minor,
        description: item.project_name,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

      if (itemsError) {
        throw itemsError;
      }

      toast({
        title: "Invoice saved",
        description: "Invoice has been saved as draft.",
      });

      // Update onboarding state for invoice draft creation
      try {
        await supabase.functions.invoke('onboarding-state', {
          body: { updates: { invoice_draft_created: true } }
        });
      } catch (error) {
        console.error('Error updating onboarding state:', error);
      }

      navigate(`/invoices/${invoice.id}`);
    } catch (error: any) {
      toast({
        title: "Error saving invoice",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const clientProjects = projects.filter(p => selectedProjectIds.includes(p.id));
  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount_minor, 0);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Invoices
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Create Invoice</h1>
              <p className="text-muted-foreground">
                {step === 'setup' ? 'Select client and projects' : 'Review and save invoice'}
              </p>
            </div>
          </div>
        </div>

        {step === 'setup' ? (
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client Selection */}
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
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
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-date" className="text-sm">Start Date</Label>
                      <Input
                        id="start-date"
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-date" className="text-sm">End Date</Label>
                      <Input
                        id="end-date"
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Currency */}
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={(value: Currency) => setCurrency(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr} value={curr}>
                          {curr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Project Selection */}
            {selectedClientId && (
              <Card>
                <CardHeader>
                  <CardTitle>Select Projects</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {projects.length === 0 ? (
                      <p className="text-muted-foreground">No projects found for this client.</p>
                    ) : (
                      projects.map((project) => (
                        <div key={project.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={project.id}
                            checked={selectedProjectIds.includes(project.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProjectIds([...selectedProjectIds, project.id]);
                              } else {
                                setSelectedProjectIds(selectedProjectIds.filter(id => id !== project.id));
                              }
                            }}
                          />
                          <Label htmlFor={project.id} className="flex-1">
                            {project.name}
                            {project.rate_hour && (
                              <span className="text-muted-foreground ml-2">
                                ({formatMoney(toMinor(project.rate_hour, currency), currency)}/hour)
                              </span>
                            )}
                          </Label>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={generatePreview} disabled={loading || !selectedClientId || selectedProjectIds.length === 0}>
                {loading ? 'Generating...' : 'Continue'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invoice Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Invoice Preview</span>
                  <div className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString()}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">To: {selectedClient?.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Period: {dateRange.start} to {dateRange.end}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Currency: {currency}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Project Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No time entries found for the selected period.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lineItems.map((item) => (
                      <div key={item.project_id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">{item.project_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDuration(item.minutes).normal} 
                            <span className="ml-1">= {formatDuration(item.minutes).industrial}h</span>
                            {item.rate_minor > 0 && (
                              <span className="ml-2">@ {formatMoney(item.rate_minor, currency)}/hour</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {formatMoney(item.amount_minor, currency)}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="border-t pt-4 flex justify-between items-center text-lg font-bold">
                      <span>Total</span>
                      <span>{formatMoney(totalAmount, currency)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('setup')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Setup
              </Button>
              
              {lineItems.length > 0 && (
                <Button onClick={saveInvoice} disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save Draft'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}