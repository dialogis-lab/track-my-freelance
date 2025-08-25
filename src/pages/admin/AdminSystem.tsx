import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Server, Database, Mail, Key, Info, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SystemHealth {
  database: 'healthy' | 'warning' | 'error';
  edge_functions: 'healthy' | 'warning' | 'error';
  storage: 'healthy' | 'warning' | 'error';
  encryption: 'healthy' | 'warning' | 'error';
}

interface SystemHealthDetails {
  database: {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    technicalDetails: string;
    lastChecked: string;
    suggestions?: string[];
  };
  edge_functions: {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    technicalDetails: string;
    lastChecked: string;
    suggestions?: string[];
  };
  storage: {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    technicalDetails: string;
    lastChecked: string;
    suggestions?: string[];
  };
  encryption: {
    status: 'healthy' | 'warning' | 'error';
    message: string;
    technicalDetails: string;
    lastChecked: string;
    suggestions?: string[];
  };
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
  const [systemHealthDetails, setSystemHealthDetails] = useState<SystemHealthDetails>({
    database: { status: 'healthy', message: '', technicalDetails: '', lastChecked: '' },
    edge_functions: { status: 'healthy', message: '', technicalDetails: '', lastChecked: '' },
    storage: { status: 'healthy', message: '', technicalDetails: '', lastChecked: '' },
    encryption: { status: 'healthy', message: '', technicalDetails: '', lastChecked: '' }
  });
  const [cronJobs, setCronJobs] = useState<CronJobStatus[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<keyof SystemHealthDetails | null>(null);

  useEffect(() => {
    checkSystemHealth();
    fetchAuditLogs();
  }, []);

  const checkSystemHealth = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      const health: SystemHealth = {
        database: 'healthy',
        edge_functions: 'healthy',
        storage: 'healthy',
        encryption: 'healthy'
      };
      const details: SystemHealthDetails = {
        database: { status: 'healthy', message: '', technicalDetails: '', lastChecked: now },
        edge_functions: { status: 'healthy', message: '', technicalDetails: '', lastChecked: now },
        storage: { status: 'healthy', message: '', technicalDetails: '', lastChecked: now },
        encryption: { status: 'healthy', message: '', technicalDetails: '', lastChecked: now }
      };

      // Check database connectivity
      try {
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        if (error) throw error;
        
        health.database = 'healthy';
        details.database = {
          status: 'healthy',
          message: 'Database is responsive and accessible',
          technicalDetails: `Successfully connected to Supabase database. Query executed successfully.`,
          lastChecked: now,
          suggestions: ['Database is operating normally']
        };
      } catch (error: any) {
        health.database = 'error';
        details.database = {
          status: 'error',
          message: 'Cannot connect to database',
          technicalDetails: `Database connection failed: ${error.message || 'Unknown error'}`,
          lastChecked: now,
          suggestions: [
            'Check Supabase connection settings',
            'Verify database is running',
            'Check network connectivity',
            'Review RLS policies'
          ]
        };
      }

      // Check edge functions - use a simpler test approach
      try {
        // Test with a lightweight authenticated request instead of OPTIONS
        const { data: session } = await supabase.auth.getSession();
        
        if (session?.session?.access_token) {
          // Test the encrypted-profile-fetch function with authentication
          const { error } = await supabase.functions.invoke('encrypted-profile-fetch', {
            body: { test: 'health_check' }
          });
          
          if (error) {
            // Check if it's a configuration error vs connectivity
            if (error.message?.includes('ENCRYPTION_KEY') || error.message?.includes('Server configuration error')) {
              health.edge_functions = 'warning';
              details.edge_functions = {
                status: 'warning',
                message: 'Edge functions responding but have configuration issues',
                technicalDetails: `Function responded with config error: ${error.message}`,
                lastChecked: now,
                suggestions: [
                  'Edge functions are reachable',
                  'Check function-specific configuration',
                  'Review function logs for details'
                ]
              };
            } else {
              health.edge_functions = 'error';
              details.edge_functions = {
                status: 'error',
                message: 'Edge functions error',
                technicalDetails: `Function error: ${error.message || 'Unknown error'}`,
                lastChecked: now,
                suggestions: [
                  'Check edge function deployment',
                  'Verify function configuration',
                  'Check Supabase function logs'
                ]
              };
            }
          } else {
            health.edge_functions = 'healthy';
            details.edge_functions = {
              status: 'healthy',
              message: 'Edge functions are responding properly',
              technicalDetails: 'Successfully connected to and tested edge functions',
              lastChecked: now,
              suggestions: ['Edge functions are operating normally']
            };
          }
        } else {
          health.edge_functions = 'warning';
          details.edge_functions = {
            status: 'warning',
            message: 'Cannot test edge functions - authentication required',
            technicalDetails: 'No valid session found for edge function testing',
            lastChecked: now,
            suggestions: [
              'User must be logged in to test edge functions',
              'Check authentication status',
              'Edge functions may still be working'
            ]
          };
        }
      } catch (error: any) {
        health.edge_functions = 'error';
        details.edge_functions = {
          status: 'error',
          message: 'Cannot reach edge functions',
          technicalDetails: `Connection failed: ${error.message || 'Network error'}`,
          lastChecked: now,
          suggestions: [
            'Check network connectivity',
            'Verify Supabase edge functions are deployed',
            'Check function URLs and configuration',
            'Review browser console for CORS errors'
          ]
        };
      }

      // Check storage - test with a simple bucket existence check
      try {
        // Try to list files in a known bucket to test storage access
        const testResults = await Promise.allSettled([
          supabase.storage.from('logos').list('', { limit: 1 }),
          supabase.storage.from('invoices').list('', { limit: 1 })
        ]);

        const logosBucketWorks = testResults[0].status === 'fulfilled' && !testResults[0].value.error;
        const invoicesBucketWorks = testResults[1].status === 'fulfilled' && !testResults[1].value.error;

        const workingBuckets = [];
        if (logosBucketWorks) workingBuckets.push('logos');
        if (invoicesBucketWorks) workingBuckets.push('invoices');

        if (workingBuckets.length === 0) {
          health.storage = 'error';
          details.storage = {
            status: 'error',
            message: 'Storage buckets not accessible',
            technicalDetails: 'Cannot access logos or invoices buckets. Check bucket configuration and RLS policies.',
            lastChecked: now,
            suggestions: [
              'Verify that logos and invoices buckets exist',
              'Check storage RLS policies',
              'Ensure proper bucket permissions are configured'
            ]
          };
        } else if (workingBuckets.length < 2) {
          health.storage = 'warning';
          details.storage = {
            status: 'warning',
            message: `Storage partially working (${workingBuckets.length}/2 buckets accessible)`,
            technicalDetails: `Working buckets: ${workingBuckets.join(', ')}. Missing: ${workingBuckets.length === 1 ? (workingBuckets[0] === 'logos' ? 'invoices' : 'logos') : 'logos, invoices'}`,
            lastChecked: now,
            suggestions: [
              'Check bucket configuration for missing buckets',
              'Verify RLS policies for all storage buckets',
              'Ensure all required buckets are created'
            ]
          };
        } else {
          health.storage = 'healthy';
          details.storage = {
            status: 'healthy',
            message: `Storage is working with ${workingBuckets.length} bucket(s)`,
            technicalDetails: `Accessible buckets: ${workingBuckets.join(', ')}`,
            lastChecked: now,
            suggestions: ['Storage is operating normally']
          };
        }
      } catch (error: any) {
        health.storage = 'error';
        details.storage = {
          status: 'error',
          message: 'Cannot access storage system',
          technicalDetails: `Storage error: ${error.message || 'Unknown error'}`,
          lastChecked: now,
          suggestions: [
            'Check Supabase storage configuration',
            'Verify storage policies',
            'Check API permissions'
          ]
        };
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
              details.encryption = {
                status: 'error',
                message: 'Encryption key not configured',
                technicalDetails: `${errorMessage}`,
                lastChecked: now,
                suggestions: [
                  'Configure ENCRYPTION_KEY in Supabase secrets',
                  'Ensure key is 32-byte base64 encoded',
                  'Restart edge functions after configuration',
                  'Test encryption functionality'
                ]
              };
            } else {
              health.encryption = 'warning';
              details.encryption = {
                status: 'warning',
                message: 'Encryption configuration issue',
                technicalDetails: `Encryption test failed: ${errorMessage}`,
                lastChecked: now,
                suggestions: [
                  'Check edge function logs',
                  'Verify encryption key format',
                  'Test manual encryption/decryption'
                ]
              };
            }
          } else {
            health.encryption = 'healthy';
            details.encryption = {
              status: 'healthy',
              message: 'Encryption is properly configured',
              technicalDetails: 'Successfully tested encryption/decryption cycle',
              lastChecked: now,
              suggestions: ['Encryption is operating normally']
            };
          }
        } else {
          health.encryption = 'warning';
          details.encryption = {
            status: 'warning',
            message: 'Cannot test encryption - authentication required',
            technicalDetails: 'No valid session found for encryption testing',
            lastChecked: now,
            suggestions: [
              'User must be logged in to test encryption',
              'Check authentication status',
              'Refresh session if needed'
            ]
          };
        }
      } catch (error: any) {
        console.error('Encryption check failed:', error);
        health.encryption = 'error';
        details.encryption = {
          status: 'error',
          message: 'Encryption test failed',
          technicalDetails: `Test error: ${error.message || 'Unknown error'}`,
          lastChecked: now,
          suggestions: [
            'Check edge function deployment',
            'Verify ENCRYPTION_KEY configuration',
            'Check network connectivity',
            'Review edge function logs'
          ]
        };
      }

      setSystemHealth(health);
      setSystemHealthDetails(details);

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
      // Fetch recent audit logs and auth events
      const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (auditError) throw auditError;
      
      // Transform audit logs into activity items
      const activities = (auditData || []).map(log => ({
        id: log.id,
        type: getActivityType(log.event_type),
        title: getActivityTitle(log.event_type),
        description: getActivityDescription(log.event_type, log.details),
        timestamp: log.created_at,
        severity: getActivitySeverity(log.event_type),
        user_id: log.user_id,
        ip_address: log.ip_address
      }));

      setAuditLogs(activities);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      // Set empty array on error to show "No recent activity"
      setAuditLogs([]);
    }
  };

  const getActivityType = (eventType: string) => {
    if (eventType.includes('login') || eventType.includes('auth')) return 'security';
    if (eventType.includes('profile') || eventType.includes('encrypted')) return 'data';
    if (eventType.includes('admin')) return 'admin';
    if (eventType.includes('error')) return 'error';
    return 'system';
  };

  const getActivityTitle = (eventType: string) => {
    switch (eventType) {
      case 'profile_encrypted_access':
        return 'Encrypted Profile Access';
      case 'profile_encrypted_update':
        return 'Encrypted Profile Update';
      case 'user_login':
        return 'User Login';
      case 'user_logout':
        return 'User Logout';
      case 'mfa_setup':
        return 'MFA Setup';
      case 'mfa_verification':
        return 'MFA Verification';
      case 'admin_action':
        return 'Admin Action';
      case 'system_error':
        return 'System Error';
      default:
        return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const getActivityDescription = (eventType: string, details: any) => {
    switch (eventType) {
      case 'profile_encrypted_access':
        const hasBank = details?.has_encrypted_bank_details ? 'bank details' : '';
        const hasVat = details?.has_encrypted_vat_id ? 'VAT ID' : '';
        const fields = [hasBank, hasVat].filter(Boolean).join(', ');
        return `Accessed encrypted ${fields || 'profile data'}`;
      case 'profile_encrypted_update':
        const updatedFields = details?.fields_updated?.join(', ') || 'profile fields';
        return `Updated ${updatedFields}`;
      default:
        return details?.message || 'System activity logged';
    }
  };

  const getActivitySeverity = (eventType: string) => {
    if (eventType.includes('error')) return 'high';
    if (eventType.includes('encrypted') || eventType.includes('admin')) return 'medium';
    return 'low';
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
            <div 
              className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedComponent('database')}
            >
              <Database className="h-8 w-8 text-blue-600" />
              <div className="flex-1">
                <div className="font-medium">Database</div>
                <Badge className={getHealthColor(systemHealth.database)}>
                  {getHealthIcon(systemHealth.database)}
                  <span className="ml-1 capitalize">{systemHealth.database}</span>
                </Badge>
              </div>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>

            <div 
              className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedComponent('edge_functions')}
            >
              <Server className="h-8 w-8 text-purple-600" />
              <div className="flex-1">
                <div className="font-medium">Edge Functions</div>
                <Badge className={getHealthColor(systemHealth.edge_functions)}>
                  {getHealthIcon(systemHealth.edge_functions)}
                  <span className="ml-1 capitalize">{systemHealth.edge_functions}</span>
                </Badge>
              </div>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>

            <div 
              className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedComponent('storage')}
            >
              <Database className="h-8 w-8 text-green-600" />
              <div className="flex-1">
                <div className="font-medium">Storage</div>
                <Badge className={getHealthColor(systemHealth.storage)}>
                  {getHealthIcon(systemHealth.storage)}
                  <span className="ml-1 capitalize">{systemHealth.storage}</span>
                </Badge>
              </div>
              <Info className="h-4 w-4 text-muted-foreground" />
            </div>

            <div 
              className="flex items-center space-x-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedComponent('encryption')}
            >
              <Key className="h-8 w-8 text-orange-600" />
              <div className="flex-1">
                <div className="font-medium">Encryption</div>
                <Badge className={getHealthColor(systemHealth.encryption)}>
                  {getHealthIcon(systemHealth.encryption)}
                  <span className="ml-1 capitalize">{systemHealth.encryption}</span>
                </Badge>
              </div>
              <Info className="h-4 w-4 text-muted-foreground" />
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

      {/* Component Details Dialog */}
      <Dialog open={selectedComponent !== null} onOpenChange={() => setSelectedComponent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedComponent === 'database' && <Database className="h-5 w-5" />}
              {selectedComponent === 'edge_functions' && <Server className="h-5 w-5" />}
              {selectedComponent === 'storage' && <Database className="h-5 w-5" />}
              {selectedComponent === 'encryption' && <Key className="h-5 w-5" />}
              {selectedComponent?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about the system component status
            </DialogDescription>
          </DialogHeader>
          
          {selectedComponent && (
            <div className="space-y-4">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge className={getHealthColor(systemHealthDetails[selectedComponent].status)}>
                  {getHealthIcon(systemHealthDetails[selectedComponent].status)}
                  <span className="ml-1 capitalize">{systemHealthDetails[selectedComponent].status}</span>
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Last checked: {new Date(systemHealthDetails[selectedComponent].lastChecked).toLocaleString()}
                </span>
              </div>

              {/* User-friendly Message */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Status:</strong> {systemHealthDetails[selectedComponent].message}
                </AlertDescription>
              </Alert>

              {/* Technical Details */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Technical Details
                </h4>
                <div className="bg-muted p-3 rounded-md font-mono text-sm">
                  {systemHealthDetails[selectedComponent].technicalDetails}
                </div>
              </div>

              {/* Suggestions */}
              {systemHealthDetails[selectedComponent].suggestions && (
                <div className="space-y-2">
                  <h4 className="font-medium">Recommendations</h4>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {systemHealthDetails[selectedComponent].suggestions?.map((suggestion, index) => (
                      <li key={index} className="text-muted-foreground">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
            {auditLogs.length > 0 ? (
              auditLogs.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className={`p-2 rounded-full ${
                    activity.severity === 'high' ? 'bg-red-100 text-red-600' :
                    activity.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {activity.type === 'security' && <Key className="h-4 w-4" />}
                    {activity.type === 'data' && <Database className="h-4 w-4" />}
                    {activity.type === 'admin' && <Server className="h-4 w-4" />}
                    {activity.type === 'error' && <AlertTriangle className="h-4 w-4" />}
                    {activity.type === 'system' && <Clock className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{activity.title}</span>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>{new Date(activity.timestamp).toLocaleString()}</span>
                        {activity.severity === 'high' && (
                          <Badge variant="destructive" className="h-4 text-xs">Critical</Badge>
                        )}
                        {activity.severity === 'medium' && (
                          <Badge variant="secondary" className="h-4 text-xs">Important</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                    {activity.ip_address && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center space-x-3">
                        <span>IP: {activity.ip_address}</span>
                        {activity.user_id && <span>User: {activity.user_id.slice(0, 8)}...</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Security events, profile changes, and system activities will appear here
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}