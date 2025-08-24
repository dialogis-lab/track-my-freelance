import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { TimerWidget } from '@/components/TimerWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, FolderOpen, Users, TrendingUp } from 'lucide-react';
import { formatTime, hoursToMinutes, calculateDurationMinutes, formatDuration } from '@/lib/timeUtils';

interface DashboardStats {
  totalProjects: number;
  totalClients: number;
  todayHours: number;
  weekHours: number;
}

interface RecentEntry {
  id: string;
  started_at: string;
  stopped_at: string | null;
  notes: string;
  projects: { name: string; clients?: { name: string } | null };
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalClients: 0,
    todayHours: 0,
    weekHours: 0,
  });
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Listen for real-time updates to time entries
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadDashboardData = async () => {
    await Promise.all([
      loadStats(),
      loadRecentEntries(),
    ]);
  };

  const loadStats = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const [projectsData, clientsData, todayData, weekData] = await Promise.all([
      supabase.from('projects').select('id').eq('archived', false).eq('user_id', user!.id),
      supabase.from('clients').select('id').eq('archived', false).eq('user_id', user!.id),
      supabase
        .from('time_entries')
        .select('started_at, stopped_at')
        .eq('user_id', user!.id)
        .gte('started_at', today.toISOString()),
      supabase
        .from('time_entries')
        .select('started_at, stopped_at')
        .eq('user_id', user!.id)
        .gte('started_at', weekStart.toISOString()),
    ]);

    const calculateHours = (entries: any[]) => {
      return entries.reduce((total, entry) => {
        const start = new Date(entry.started_at);
        const end = entry.stopped_at ? new Date(entry.stopped_at) : new Date();
        return total + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);
    };

    setStats({
      totalProjects: projectsData.data?.length || 0,
      totalClients: clientsData.data?.length || 0,
      todayHours: calculateHours(todayData.data || []),
      weekHours: calculateHours(weekData.data || []),
    });
  };

  const loadRecentEntries = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        id, started_at, stopped_at, notes,
        projects:project_id (
          name,
          clients:client_id (name)
        )
      `)
      .order('started_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error loading recent entries:', error);
    } else {
      setRecentEntries(data || []);
    }
  };

  const formatEntryDuration = (start: string, end: string | null) => {
    if (!end) return "Running...";
    
    const startTime = new Date(start);
    const endTime = new Date(end);
    const minutes = calculateDurationMinutes(startTime, endTime);
    
    return formatTime(minutes, true);  // Show both formats
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your time tracking overview.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weekHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalClients}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Timer Widget */}
          <div>
            <TimerWidget />
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentEntries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    No time entries yet. Start tracking your first project!
                  </p>
                ) : (
                  recentEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex-1">
                        <p className="font-medium">
                          {entry.projects.clients?.name ? `${entry.projects.clients.name} - ` : ''}
                          {entry.projects.name}
                        </p>
                        {entry.notes && (
                          <p className="text-sm text-muted-foreground">{entry.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(entry.started_at)}
                        </p>
                      </div>
                      <div className="text-sm font-mono">
                        {(() => {
                          const minutes = calculateDurationMinutes(new Date(entry.started_at), entry.stopped_at ? new Date(entry.stopped_at) : undefined);
                          const duration = formatDuration(minutes);
                          return (
                            <>
                              <div className="font-bold">{duration.normal}</div>
                              <div className="text-xs text-muted-foreground">= {duration.industrial}h</div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}