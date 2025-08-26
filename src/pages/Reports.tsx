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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendChart } from '@/components/TrendChart';
import { TimeEntriesTable } from '@/components/TimeEntriesTable';
import { formatTime, calculateDurationMinutes, formatTimeForCSV, formatDuration } from '@/lib/timeUtils';

interface TimeEntry {
  id: string;
  started_at: string;
  stopped_at: string | null;
  notes: string;
  tags?: string[] | null;
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
  pomodoroHours: number;
  pomodoroSessions: number;
  byProject: Record<string, { hours: number; value: number; entries: number }>;
  byClient: Record<string, { hours: number; value: number; entries: number }>;
}

export default function Reports() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [summary, setSummary] = useState<ReportSummary>({
    totalHours: 0,
    totalValue: 0,
    entriesCount: 0,
    pomodoroHours: 0,
    pomodoroSessions: 0,
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
  const [clientFilter, setClientFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string; client_name?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadFiltersData();
      loadReport();
      
      // Handle URL parameters for range, client, and project
      const params = new URLSearchParams(window.location.search);
      const range = params.get('range');
      const client = params.get('client');
      const project = params.get('project');
      
      if (range === 'today') {
        const today = new Date().toISOString().split('T')[0];
        setStartDate(today);
        setEndDate(today);
      } else if (range === 'week') {
        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        setStartDate(weekStart.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
      } else if (range === 'month') {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(monthStart.toISOString().split('T')[0]);
        setEndDate(today.toISOString().split('T')[0]);
      }
      
      if (client) {
        setClientFilter(client);
      }
      
      if (project) {
        setProjectFilter(project);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadReport();
    }
  }, [startDate, endDate, clientFilter, projectFilter, tagFilter, user]);

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
        id, started_at, stopped_at, notes, tags,
        projects:project_id (
          name, rate_hour,
          clients:client_id (name)
        )
      `)
      .gte('started_at', `${startDate}T00:00:00.000Z`)
      .lte('started_at', `${endDate}T23:59:59.999Z`)
      .not('stopped_at', 'is', null)
      .order('started_at', { ascending: false });

    // Apply client filter by filtering projects that belong to the client
    if (clientFilter && clientFilter !== 'all') {
      const { data: clientProjects } = await supabase
        .from('projects')
        .select('id')
        .eq('client_id', clientFilter);
      
      if (clientProjects && clientProjects.length > 0) {
        query = query.or(clientProjects.map(p => `project_id.eq.${p.id}`).join(','));
      } else {
        // If no projects found for this client, return empty result
        setEntries([]);
        calculateSummary([]);
        setLoading(false);
        return;
      }
    }
    // Apply project filter if provided
    if (projectFilter && projectFilter !== 'all') {
      query = query.eq('project_id', projectFilter);
    }

    // Apply tag filter
    if (tagFilter && tagFilter !== 'all') {
      if (tagFilter === 'pomodoro') {
        query = query.contains('tags', ['pomodoro']);
      } else if (tagFilter === 'non-pomodoro') {
        query = query.or('tags.is.null,not.tags.cs.{pomodoro}');
      }
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
      pomodoroHours: 0,
      pomodoroSessions: 0,
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

      // Track Pomodoro sessions
      if (entry.tags?.includes('pomodoro')) {
        summary.pomodoroHours += hours;
        summary.pomodoroSessions += 1;
      }

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
    const headers = ['Date', 'Project', 'Client', 'Start Time', 'End Time', 'Duration (H:M)', 'Duration (Decimal Hours)', 'Rate', 'Value', 'Notes'];
    const rows = entries.map(entry => {
      if (!entry.stopped_at) return [];
      
      const start = new Date(entry.started_at);
      const end = new Date(entry.stopped_at);
      const minutes = calculateDurationMinutes(start, end);
      const hours = minutes / 60;
      const rate = entry.projects.rate_hour || 0;
      const value = hours * rate;
      const timeFormat = formatTimeForCSV(minutes);

      return [
        start.toLocaleDateString(),
        entry.projects.name,
        entry.projects.clients?.name || 'No Client',
        start.toLocaleTimeString(),
        end.toLocaleTimeString(),
        timeFormat.duration_hm,
        timeFormat.duration_decimal,
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Analyze your time entries and export data.</p>
        </div>

        {/* Filters */}
        <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
          <h3 className="text-lg font-semibold mb-3">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-sm font-medium">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-sm font-medium">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Client</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.client_name ? `${project.client_name} - ` : ''}{project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchFilter" className="text-sm font-medium">Search Notes</Label>
              <Input
                id="searchFilter"
                type="text"
                placeholder="Search in notes..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tag Filter</Label>
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="h-9 text-sm max-w-xs">
                  <SelectValue placeholder="All entries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entries</SelectItem>
                  <SelectItem value="pomodoro">Pomodoro only</SelectItem>
                  <SelectItem value="non-pomodoro">Non-Pomodoro only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6">
          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Total Hours</h3>
            <div className="text-2xl font-bold tabular-nums">{formatDuration(Math.round(summary.totalHours * 60)).normal}</div>
            <div className="text-sm text-muted-foreground">= {formatDuration(Math.round(summary.totalHours * 60)).industrial}h</div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Total Value</h3>
            <div className="text-2xl font-bold tabular-nums">${summary.totalValue.toFixed(2)}</div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Entries</h3>
            <div className="text-2xl font-bold tabular-nums">{summary.entriesCount}</div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Pomodoro Focus</h3>
            <div className="text-xl font-bold tabular-nums">{formatDuration(Math.round(summary.pomodoroHours * 60)).normal}</div>
            <div className="text-sm text-muted-foreground">{summary.pomodoroSessions} sessions</div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Focus Ratio</h3>
            <div className="text-xl font-bold tabular-nums">
              {summary.totalHours > 0 ? Math.round((summary.pomodoroHours / summary.totalHours) * 100) : 0}%
            </div>
            <div className="text-sm text-muted-foreground">of total time</div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-sm font-medium text-muted-foreground">Average Streak</h3>
            <div className="text-xl font-bold tabular-nums">
              {summary.pomodoroSessions > 0 ? Math.round(summary.pomodoroSessions / (summary.entriesCount > 0 ? summary.entriesCount : 1)) : 0}
            </div>
            <div className="text-sm text-muted-foreground">sessions per day</div>
          </div>
        </div>

        {/* Export Buttons - Remove duplicate */}

        {/* Trend Chart */}
        <div className="rounded-xl border bg-card shadow-sm min-h-[280px]">
          <TrendChart
            startDate={startDate}
            endDate={endDate}
            clientFilter={clientFilter}
            projectFilter={projectFilter}
            tagFilter={tagFilter}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-lg font-semibold mb-3">Hours by Project</h3>
            {Object.keys(summary.byProject).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(summary.byProject).map(([name, data]) => ({
                  name,
                  hours: data.hours
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="hours" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-lg font-semibold mb-3">Hours by Client</h3>
            {Object.keys(summary.byClient).length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(summary.byClient).map(([name, data], index) => ({
                      name,
                      hours: data.hours,
                      fill: `hsl(${index * 137.5 % 360}, 70%, 50%)`
                    }))}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="hours"
                    label={({ name, hours }) => `${name}: ${hours.toFixed(1)}h`}
                  />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data for selected period
              </div>
            )}
          </div>
        </div>

        {/* Breakdown Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-lg font-semibold mb-3">By Project</h3>
            <div className="space-y-2">
              {Object.entries(summary.byProject).map(([project, data]) => (
                <div key={project} className="flex justify-between items-center py-2 border-b border-border last:border-0 min-h-[56px]">
                  <span className="font-medium">{project}</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatDuration(Math.round(data.hours * 60)).normal}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">= {formatDuration(Math.round(data.hours * 60)).industrial}h • ${data.value.toFixed(2)}</div>
                  </div>
                </div>
              ))}
              {Object.keys(summary.byProject).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No data for selected period</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5">
            <h3 className="text-lg font-semibold mb-3">By Client</h3>
            <div className="space-y-2">
              {Object.entries(summary.byClient).map(([client, data]) => (
                <div key={client} className="flex justify-between items-center py-2 border-b border-border last:border-0 min-h-[56px]">
                  <span className="font-medium">{client}</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatDuration(Math.round(data.hours * 60)).normal}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">= {formatDuration(Math.round(data.hours * 60)).industrial}h • ${data.value.toFixed(2)}</div>
                  </div>
                </div>
              ))}
              {Object.keys(summary.byClient).length === 0 && (
                <p className="text-muted-foreground text-center py-4">No data for selected period</p>
              )}
            </div>
          </div>
        </div>

        {/* Time Entries Table */}
        <TimeEntriesTable
          startDate={startDate}
          endDate={endDate}
          clientFilter={clientFilter}
          projectFilter={projectFilter}
          tagFilter={tagFilter}
          searchFilter={searchFilter}
        />
      </div>
    </AppLayout>
  );
}