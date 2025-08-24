import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { TimerWidget } from '@/components/TimerWidget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, FolderOpen, Users, TrendingUp, ExternalLink } from 'lucide-react';
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
  const { timerUpdated } = useTimerContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Refresh dashboard when timer events occur
  useEffect(() => {
    if (user && timerUpdated > 0) {
      loadDashboardData();
    }
  }, [user, timerUpdated]);

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
      supabase.from('clients').select(`
        id,
        projects:projects!client_id (id, archived)
      `).eq('archived', false).eq('user_id', user!.id),
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

    // Count clients with at least one active project
    const activeClientsCount = clientsData.data?.filter(client => 
      client.projects && client.projects.some((p: any) => !p.archived)
    ).length || 0;

    setStats({
      totalProjects: projectsData.data?.length || 0,
      totalClients: activeClientsCount,
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

  const handleCardClick = (route: string) => {
    navigate(route);
  };

  const handleKeyDown = (event: React.KeyboardEvent, route: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigate(route);
    }
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
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors duration-200 group relative"
            onClick={() => handleCardClick('/reports?range=today')}
            onKeyDown={(e) => handleKeyDown(e, '/reports?range=today')}
            tabIndex={0}
            role="button"
            aria-label="View today's time report"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.todayHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors duration-200 group relative"
            onClick={() => handleCardClick('/reports?range=week')}
            onKeyDown={(e) => handleKeyDown(e, '/reports?range=week')}
            tabIndex={0}
            role="button"
            aria-label="View this week's time report"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.weekHours.toFixed(1)}h</div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors duration-200 group relative"
            onClick={() => handleCardClick('/projects?status=active')}
            onKeyDown={(e) => handleKeyDown(e, '/projects?status=active')}
            tabIndex={0}
            role="button"
            aria-label="View active projects"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <div className="flex items-center space-x-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProjects}</div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors duration-200 group relative"
            onClick={() => handleCardClick('/clients?status=active')}
            onKeyDown={(e) => handleKeyDown(e, '/clients?status=active')}
            tabIndex={0}
            role="button"
            aria-label="View active clients"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
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