import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { formatDuration, calculateDurationMinutes } from '@/lib/timeUtils';
import { formatMoney, Currency, CURRENCIES } from '@/lib/currencyUtils';
import { Calendar, Download, Save } from 'lucide-react';
import { InvoiceData, InvoiceLineItem } from '@/types/invoice';

interface Project {
  id: string;
  name: string;
  rate_hour: number | null;
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

interface InvoiceWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export function InvoiceWizard({ open, onOpenChange, clientId, clientName }: InvoiceWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [currency, setCurrency] = useState<Currency>('USD');
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'setup' | 'preview'>('setup');

  useEffect(() => {
    if (open && user) {
      loadProjects();
    }
  }, [open, user, clientId]);

  const loadProjects = async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, rate_hour')
      .eq('client_id', clientId)
      .eq('archived', false);

    if (error) {
      toast({
        title: "Error loading projects",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setProjects(data || []);
  };

  const generatePreview = async () => {
    if (selectedProjects.length === 0) {
      toast({
        title: "No projects selected",
        description: "Please select at least one project.",
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
        .in('project_id', selectedProjects)
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
            hours: 0,
            rate_per_hour: ratePerHour,
            total: 0,
          };
        }

        const minutes = calculateDurationMinutes(
          new Date(entry.started_at),
          new Date(entry.stopped_at!)
        );
        const hours = minutes / 60;

        projectTotals[projectId].hours += hours;
        projectTotals[projectId].total = projectTotals[projectId].hours * ratePerHour;
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

  const saveAsDraft = async () => {
    if (lineItems.length === 0) return;

    setLoading(true);

    try {
      const totalMinor = lineItems.reduce((sum, item) => sum + Math.round(item.total * 100), 0);

      const { error } = await supabase
        .from('invoices')
        .insert({
          user_id: user!.id,
          client_id: clientId,
          project_ids: selectedProjects,
          currency,
          total_minor: totalMinor,
          status: 'draft',
        });

      if (error) {
        throw error;
      }

      toast({
        title: "Invoice saved",
        description: "Invoice has been saved as draft.",
      });

      onOpenChange(false);
      setStep('setup');
      setSelectedProjects([]);
      setLineItems([]);
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

  const downloadPDF = async () => {
    // For now, just show a placeholder message
    toast({
      title: "PDF Download",
      description: "PDF generation will be implemented in the next phase.",
    });
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + item.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'setup' ? 'Create Invoice' : 'Invoice Preview'} - {clientName}
          </DialogTitle>
        </DialogHeader>

        {step === 'setup' ? (
          <div className="space-y-6">
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

            {/* Project Selection */}
            <div className="space-y-2">
              <Label>Select Projects</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={project.id}
                      checked={selectedProjects.includes(project.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedProjects([...selectedProjects, project.id]);
                        } else {
                          setSelectedProjects(selectedProjects.filter(id => id !== project.id));
                        }
                      }}
                    />
                    <Label htmlFor={project.id} className="flex-1">
                      {project.name}
                      {project.rate_hour && (
                        <span className="text-muted-foreground ml-2">
                          ({formatMoney(Math.round((project.rate_hour || 0) * 100), currency)}/hour)
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={generatePreview} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Preview'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Invoice Header */}
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
                <div className="text-lg font-semibold">To: {clientName}</div>
                <div className="text-sm text-muted-foreground">
                  Period: {dateRange.start} to {dateRange.end}
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader>
                <CardTitle>Project Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {lineItems.map((item) => (
                    <div key={item.project_id} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <div className="font-medium">{item.project_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDuration(Math.round(item.hours * 60)).normal} 
                          <span className="ml-1">= {formatDuration(Math.round(item.hours * 60)).industrial}h</span>
                          {item.rate_per_hour > 0 && (
                            <span className="ml-2">@ {formatMoney(Math.round(item.rate_per_hour * 100), currency)}/hour</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {formatMoney(Math.round(item.total * 100), currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t pt-4 flex justify-between items-center text-lg font-bold">
                    <span>Total</span>
                    <span>{formatMoney(Math.round(totalAmount * 100), currency)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('setup')}>
                Back to Setup
              </Button>
              <div className="space-x-2">
                <Button variant="outline" onClick={downloadPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
                <Button onClick={saveAsDraft} disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save as Draft'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}