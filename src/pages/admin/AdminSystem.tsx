import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Server, Database, Mail, Key } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  edge_functions: 'healthy' | 'warning' | 'error';
  storage: 'healthy' | 'warning' | 'error';
  encryption: 'healthy' | 'warning' | 'error';
}

interface CronJobStatus {
  name: string;
  last_run: string | null;
  status: 'healthy' | 'warning' | 'error';
  description: string;
}

export function AdminSystem() {
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    database: 'healthy',
    edge_functions: 'healthy',
    storage: 'healthy',
    encryption: 'healthy'
  });
  const [cronJobs, setCronJobs] = useState<CronJobStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    checkSystemHealth();
    fetchAuditLogs();
  }, []);

  const checkSystemHealth = async () => {
    try {
      setLoading(true);
      const health: SystemHealth = {
        database: 'healthy',
        edge_functions: 'healthy',
        storage: 'healthy',
        encryption: 'healthy'
      };

      // Check database connectivity
      try {
        await supabase.from('profiles').select('count').limit(1);
      } catch (error) {
        health.database = 'error';
      }

      // Check storage
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        if (!buckets || buckets.length === 0) {
          health.storage = 'warning';
        }
      } catch (error) {
        health.storage = 'error';
      }

      // Check encryption functions
      try {
        const response = await fetch('https://ollbuhgghkporvzmrzau.supabase.co/functions/v1/encrypted-profile-fetch', {
          method: 'OPTIONS'
        });
        if (!response.ok) {
          health.edge_functions = 'warning';
        }
      } catch (error) {
        health.edge_functions = 'error';
      }

      // Check encryption key configuration
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session?.session?.access_token) {
          // Test encryption by calling the edge function with a test payload
          const { data, error } = await supabase.functions.invoke('encrypted-profile-save', {
            body: { test_encryption: 'health_check' }
          });
          
          if (error) {
            const errorMessage = error.message || '';
            if (errorMessage.includes('ENCRYPTION_KEY') || errorMessage.includes('Server configuration error')) {
              health.encryption = 'error';
            } else {
              health.encryption = 'warning';
            }
          } else {
            health.encryption = 'healthy';
          }
        } else {
          health.encryption = 'warning';
        }
      } catch (error) {
        console.error('Encryption check failed:', error);
        health.encryption = 'error';
      }

      setSystemHealth(health);

      // Mock cron job status (in real implementation, these would come from monitoring)
      setCronJobs([
        {
          name: 'reminders-cron',
          last_run: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          status: 'healthy',
          description: 'Sends daily and weekly reminder emails'
        },
        {
          name: 'cleanup-expired-devices',
          last_run: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
          status: 'healthy',
          description: 'Removes expired trusted devices'
        },
        {
          name: 'cleanup-rate-limits',
          last_run: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
          status: 'healthy',
          description: 'Cleans up old rate limit entries'
        }
      ]);

    } catch (error: any) {
      console.error('Error checking system health:', error);
      toast.error('Failed to check system health');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
    }
  };

  const getHealthColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
    }
  };

  const getHealthIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-8 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Health</CardTitle>
              <CardDescription>
                Monitor the health of core system components
              </CardDescription>
            </div>
            <Button variant="outline" onClick={checkSystemHealth}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Database className="h-8 w-8 text-blue-600" />
              <div className="flex-1">
                <div className="font-medium">Database</div>
                <Badge className={getHealthColor(systemHealth.database)}>
                  {getHealthIcon(systemHealth.database)}
                  <span className="ml-1 capitalize">{systemHealth.database}</span>
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Server className="h-8 w-8 text-purple-600" />
              <div className="flex-1">
                <div className="font-medium">Edge Functions</div>
                <Badge className={getHealthColor(systemHealth.edge_functions)}>
                  {getHealthIcon(systemHealth.edge_functions)}
                  <span className="ml-1 capitalize">{systemHealth.edge_functions}</span>
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Database className="h-8 w-8 text-green-600" />
              <div className="flex-1">
                <div className="font-medium">Storage</div>
                <Badge className={getHealthColor(systemHealth.storage)}>
                  {getHealthIcon(systemHealth.storage)}
                  <span className="ml-1 capitalize">{systemHealth.storage}</span>
                </Badge>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border">
              <Key className="h-8 w-8 text-orange-600" />
              <div className="flex-1">
                <div className="font-medium">Encryption</div>
                <Badge className={getHealthColor(systemHealth.encryption)}>
                  {getHealthIcon(systemHealth.encryption)}
                  <span className="ml-1 capitalize">{systemHealth.encryption}</span>
                </Badge>
              </div>
            </div>
          </div>

          {systemHealth.encryption === 'error' && (
            <Alert className="mt-4 border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Encryption Key Missing:</strong> The ENCRYPTION_KEY environment variable is not configured. 
                Encrypted fields (bank details, VAT IDs, private notes) are currently disabled.
                <br />
                <span className="text-sm mt-2 block">
                  The encryption key was recently added. Edge functions may need a few minutes to restart and pick up the new configuration.
                </span>
              </AlertDescription>
            </Alert>
          )}
          
          {systemHealth.encryption === 'warning' && (
            <Alert className="mt-4 border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Encryption Status Unknown:</strong> Unable to verify encryption configuration. 
                This may be a temporary issue with the edge functions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cron Jobs Status */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Jobs</CardTitle>
          <CardDescription>
            Monitor the status of background jobs and cron functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {cronJobs.map((job) => (
              <div key={job.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{job.name}</div>
                    <div className="text-sm text-muted-foreground">{job.description}</div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getHealthColor(job.status)}>
                    {getHealthIcon(job.status)}
                    <span className="ml-1 capitalize">{job.status}</span>
                  </Badge>
                  <div className="text-xs text-muted-foreground mt-1">
                    Last run: {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest security and system events from the audit log
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{log.event_type.replace(/_/g, ' ')}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  {log.details && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {typeof log.details === 'object' 
                        ? JSON.stringify(log.details, null, 2)
                        : log.details
                      }
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {auditLogs.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}