import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTimerContext } from '@/contexts/TimerContext';
import { useDashboardTimers } from '@/hooks/useDashboardTimers';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { CombinedTimerCard } from '@/components/CombinedTimerCard';
import { PlanBadge } from '@/components/PlanBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, FolderOpen, Users, TrendingUp, ExternalLink, Receipt } from 'lucide-react';
import { formatTime, hoursToMinutes, calculateDurationMinutes, formatDuration } from '@/lib/timeUtils';
import { formatMoney, type Currency } from '@/lib/currencyUtils';
import { usePlan } from '@/hooks/usePlan';

interface DashboardStats {
  totalProjects: number;
  totalClients: number;
  todayHours: number;
  weekHours: number;
  totalExpenses: Partial<Record<Currency, number>>;
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
    totalExpenses: {},
  });
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const { user } = useAuth();
  const { timerUpdated } = useTimerContext();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { refetchPlan } = usePlan();
  
  // Dashboard Timer Hook
  const {
    getStopwatchDisplayTime,
    isStopwatchRunning,
    loading: timerLoading
  } = useDashboardTimers();

  useEffect(() => {
    const handleBillingUpdate = async () => {
      const justUpgraded = localStorage.getItem('billingJustUpgraded');
      const urlParams = new URLSearchParams(window.location.search);
      const hasUpgradedParam = urlParams.get('upgraded');
      
      if (justUpgraded === '1' || hasUpgradedParam === '1') {
        console.log('Billing just upgraded, refreshing plan status');
        await refetchPlan();
        localStorage.removeItem('billingJustUpgraded');
        
        // Clean up URL parameter
        if (hasUpgradedParam) {
          urlParams.delete('upgraded');
          const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
          window.history.replaceState({}, '', newUrl);
        }
      }
    };

    handleBillingUpdate();
  }, [refetchPlan]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Set debug mode for timer
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('TIMER_DEBUG', '1');
    }
  }, []);

  // Refresh dashboard when timer events occur 
  useEffect(() => {
    if (user && timerUpdated > 0) {
      // Small delay to allow database operations to complete
      const timer = setTimeout(() => {
        loadDashboardData();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [user, timerUpdated]);

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

    const [projectsData, clientsData, todayData, weekData, expensesData] = await Promise.all([
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
      supabase
        .from('expenses')
        .select('gross_amount_cents, currency')
        .eq('user_id', user!.id)
        .eq('billable', true),
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

    // Calculate expense totals by currency
    const expenseTotals = expensesData.data?.reduce((acc, expense) => {
      const currency = expense.currency as Currency;
      if (!acc[currency]) acc[currency] = 0;
      acc[currency] += expense.gross_amount_cents;
      return acc;
    }, {} as Record<Currency, number>) || {};

    setStats({
      totalProjects: projectsData.data?.length || 0,
      totalClients: activeClientsCount,
      todayHours: calculateHours(todayData.data || []),
      weekHours: calculateHours(weekData.data || []),
      totalExpenses: expenseTotals,
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
      .eq('user_id', user!.id)
      .not('stopped_at', 'is', null)
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
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-6 space-y-6">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-brand-gradient">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back! Here's your time tracking overview.</p>
              </div>
              <PlanBadge />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card 
              className="cursor-pointer card-hover transition-smooth group relative rounded-xl border bg-card shadow-sm p-4 sm:p-5"
              onClick={() => handleCardClick('/reports?range=today')}
              onKeyDown={(e) => handleKeyDown(e, '/reports?range=today')}
              tabIndex={0}
              role="button"
              aria-label="View today's time report"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
                <CardTitle className="text-sm font-medium">Today's Hours</CardTitle>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-brand-gradient" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl font-bold text-brand-gradient">{stats.todayHours.toFixed(1)}h</div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer card-hover transition-smooth group relative rounded-xl border bg-card shadow-sm p-4 sm:p-5"
              onClick={() => handleCardClick('/reports?range=week')}
              onKeyDown={(e) => handleKeyDown(e, '/reports?range=week')}
              tabIndex={0}
              role="button"
              aria-label="View this week's time report"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-brand-gradient" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl font-bold text-brand-gradient">{stats.weekHours.toFixed(1)}h</div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer card-hover transition-smooth group relative rounded-xl border bg-card shadow-sm p-4 sm:p-5"
              onClick={() => handleCardClick('/projects?status=active')}
              onKeyDown={(e) => handleKeyDown(e, '/projects?status=active')}
              tabIndex={0}
              role="button"
              aria-label="View active projects"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
                <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                <div className="flex items-center space-x-2">
                  <FolderOpen className="h-4 w-4 text-brand-gradient" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl font-bold text-brand-gradient">{stats.totalProjects}</div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer card-hover transition-smooth group relative rounded-xl border bg-card shadow-sm p-4 sm:p-5"
              onClick={() => handleCardClick('/clients?status=active')}
              onKeyDown={(e) => handleKeyDown(e, '/clients?status=active')}
              tabIndex={0}
              role="button"
              aria-label="View active clients"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
                <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-brand-gradient" />
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="text-2xl font-bold text-brand-gradient">{stats.totalClients}</div>
              </CardContent>
            </Card>
          </div>

          {/* Second row of stats - Expenses */}
          {Object.keys(stats.totalExpenses).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="cursor-pointer card-hover transition-smooth group relative rounded-xl border bg-card shadow-sm p-4 sm:p-5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
                  <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                  <div className="flex items-center space-x-2">
                    <Receipt className="h-4 w-4 text-brand-gradient" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="space-y-1">
                    {Object.entries(stats.totalExpenses).map(([currency, amount]) => (
                      <div key={currency} className="text-lg font-bold text-brand-gradient">
                        {formatMoney(amount, currency as Currency)}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(420px,520px)] gap-6 items-start">
            {/* Combined Timer Card */}
            <div className="flex justify-center xl:justify-start">
              <CombinedTimerCard />
            </div>
            
            {/* Recent Activity */}
            <Card className="rounded-xl border bg-card shadow-sm">
              <CardHeader className="p-4 sm:p-5 pb-3">
                <CardTitle className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 pt-0">
                {recentEntries.length === 0 ? (
                  <div className="py-10 text-sm text-muted-foreground text-center">
                    No time entries yet. Start tracking your first project!
                  </div>
                ) : (
                  <>
                    <ul className="divide-y divide-border">
                      {recentEntries.map((entry) => (
                        <li
                          key={entry.id}
                          className="group flex items-center justify-between gap-3 py-3.5 sm:py-4 min-h-[44px] hover:bg-muted/50 rounded-md px-2 -mx-2 transition-colors"
                        >
                          <div className="min-w-0">
                            <div 
                              className="text-[15px] sm:text-base font-medium truncate"
                              title={`${entry.projects.clients?.name ? `${entry.projects.clients.name} — ` : ''}${entry.projects.name}`}
                            >
                              {entry.projects.clients?.name ? `${entry.projects.clients.name} — ` : ''}
                              {entry.projects.name}
                            </div>
                            {entry.notes && (
                              <div 
                                className="text-xs sm:text-sm text-muted-foreground truncate"
                                title={entry.notes}
                              >
                                {entry.notes}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(entry.started_at)}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {(() => {
                              const minutes = calculateDurationMinutes(new Date(entry.started_at), entry.stopped_at ? new Date(entry.stopped_at) : undefined);
                              const duration = formatDuration(minutes);
                              return (
                                <>
                                  <div className="text-[15px] sm:text-base font-semibold tabular-nums">
                                    {duration.normal}
                                  </div>
                                  <div className="text-xs text-muted-foreground tabular-nums">
                                    = {duration.industrial}h
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-3">
                      <a href="/reports" className="text-xs sm:text-sm text-primary hover:underline">View all entries →</a>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}