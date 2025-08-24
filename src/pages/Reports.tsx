import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';

interface TimeEntry {
  id: string;
  started_at: string;
  stopped_at: string | null;
  notes: string;
  projects: {
    name: string;
    rate_hour: number | null;
    clients?: { name: string } | null;
  };
}

interface ReportSummary {
  totalHours: number;
  totalValue: number;
  entriesCount: number;
  byProject: Record<string, { hours: number; value: number; entries: number }>;
  byClient: Record<string, { hours: number; value: number; entries: number }>;
}

export default function Reports() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    totalHours: 0,
    totalValue: 0,
    entriesCount: 0,
    byProject: {},
    byClient: {},
  });
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [clientFilter, setClientFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; client_name?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadFiltersData();
      loadReport();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadReport();
    }
  }, [startDate, endDate, clientFilter, projectFilter, user]);

  const loadFiltersData = async () => {
    const [clientsData, projectsData] = await Promise.all([
      supabase.from('clients').select('id, name').eq('archived', false).order('name'),
      supabase.from('projects').select(`
        id, name,
        clients:client_id (name)
      `).eq('archived', false).order('name'),
    ]);

    if (clientsData.data) setClients(clientsData.data);
    if (projectsData.data) {
      setProjects(projectsData.data.map(p => ({
        id: p.id,
        name: p.name,
        client_name: p.clients?.name,
      })));
    }
  };

  const loadReport = async () => {
    setLoading(true);
    
    let query = supabase
      .from('time_entries')
      .select(`
        id, started_at, stopped_at, notes,
        projects:project_id (
          name, rate_hour,
          clients:client_id (name)
        )
      `)
      .gte('started_at', `${startDate}T00:00:00.000Z`)
      .lte('started_at', `${endDate}T23:59:59.999Z`)
      .not('stopped_at', 'is', null)
      .order('started_at', { ascending: false });

    if (clientFilter) {
      query = query.eq('projects.client_id', clientFilter);
    }
    
    if (projectFilter) {
      query = query.eq('project_id', projectFilter);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading report:', error);
      toast({
        title: "Error loading report",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEntries(data || []);
      calculateSummary(data || []);
    }
    
    setLoading(false);
  };

  const calculateSummary = (entries: TimeEntry[]) => {
    const summary: ReportSummary = {
      totalHours: 0,
      totalValue: 0,
      entriesCount: entries.length,
      byProject: {},
      byClient: {},
    };

    entries.forEach((entry) => {
      if (!entry.stopped_at) return;

      const start = new Date(entry.started_at);
      const end = new Date(entry.stopped_at);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const value = hours * (entry.projects.rate_hour || 0);

      summary.totalHours += hours;
      summary.totalValue += value;

      // By project
      const projectKey = entry.projects.name;
      if (!summary.byProject[projectKey]) {
        summary.byProject[projectKey] = { hours: 0, value: 0, entries: 0 };
      }
      summary.byProject[projectKey].hours += hours;
      summary.byProject[projectKey].value += value;
      summary.byProject[projectKey].entries += 1;

      // By client
      const clientKey = entry.projects.clients?.name || 'No Client';
      if (!summary.byClient[clientKey]) {
        summary.byClient[clientKey] = { hours: 0, value: 0, entries: 0 };
      }
      summary.byClient[clientKey].hours += hours;
      summary.byClient[clientKey].value += value;
      summary.byClient[clientKey].entries += 1;
    });

    setSummary(summary);
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Project', 'Client', 'Start Time', 'End Time', 'Duration (Hours)', 'Rate', 'Value', 'Notes'];
    const rows = entries.map(entry => {
      if (!entry.stopped_at) return [];
      
      const start = new Date(entry.started_at);
      const end = new Date(entry.stopped_at);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      const rate = entry.projects.rate_hour || 0;
      const value = hours * rate;

      return [
        start.toLocaleDateString(),
        entry.projects.name,
        entry.projects.clients?.name || 'No Client',
        start.toLocaleTimeString(),
        end.toLocaleTimeString(),
        hours.toFixed(2),
        rate.toFixed(2),
        value.toFixed(2),
        entry.notes || '',
      ];
    }).filter(row => row.length > 0);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-report-${startDate}-to-${endDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Report exported",
      description: "CSV file has been downloaded successfully.",
    });
  };

  const exportToPDF = () => {
    // Simple HTML to PDF approach
    const html = `
      <html>
        <head>
          <title>Time Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .summary { background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <h1>Time Report</h1>
          <p>Period: ${startDate} to ${endDate}</p>
          
          <div class="summary">
            <h3>Summary</h3>
            <p>Total Hours: ${summary.totalHours.toFixed(2)}</p>
            <p>Total Value: $${summary.totalValue.toFixed(2)}</p>
            <p>Total Entries: ${summary.entriesCount}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Client</th>
                <th>Duration</th>
                <th>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${entries.map(entry => {
                if (!entry.stopped_at) return '';
                const start = new Date(entry.started_at);
                const end = new Date(entry.stopped_at);
                const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                const value = hours * (entry.projects.rate_hour || 0);
                
                return `
                  <tr>
                    <td>${start.toLocaleDateString()}</td>
                    <td>${entry.projects.name}</td>
                    <td>${entry.projects.clients?.name || 'No Client'}</td>
                    <td>${hours.toFixed(2)}h</td>
                    <td>$${value.toFixed(2)}</td>
                    <td>${entry.notes || ''}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.print();
    }

    toast({
      title: "PDF report opened",
      description: "Use your browser's print function to save as PDF.",
    });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground">Analyze your time entries and export data.</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All clients</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All projects</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.client_name ? `${project.client_name} - ` : ''}{project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.totalHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${summary.totalValue.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summary.entriesCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Export Buttons */}
        <div className="flex space-x-4">
          <Button onClick={exportToCSV} disabled={loading || entries.length === 0}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={exportToPDF} disabled={loading || entries.length === 0}>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>

        {/* Breakdown Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>By Project</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.byProject).map(([project, data]) => (
                  <div key={project} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span className="font-medium">{project}</span>
                    <div className="text-right">
                      <div className="text-sm">{data.hours.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">${data.value.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                {Object.keys(summary.byProject).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No data for selected period</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Client</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(summary.byClient).map(([client, data]) => (
                  <div key={client} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <span className="font-medium">{client}</span>
                    <div className="text-right">
                      <div className="text-sm">{data.hours.toFixed(1)}h</div>
                      <div className="text-xs text-muted-foreground">${data.value.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
                {Object.keys(summary.byClient).length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No data for selected period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}