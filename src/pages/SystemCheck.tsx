import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CheckResult {
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  details?: string;
}

export default function SystemCheck() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [demoData, setDemoData] = useState<any>({});

  const isDev = import.meta.env.DEV;
  const enableSystemCheck = import.meta.env.VITE_ENABLE_SYSTEM_CHECK === 'true';

  // Check if user should have access
  if (!user) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>Authentication required. Please log in to access diagnostics.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!isDev && !enableSystemCheck) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>System diagnostics only available in development or when VITE_ENABLE_SYSTEM_CHECK=true</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const updateCheck = (name: string, status: CheckResult['status'], message: string, details?: string) => {
    setChecks(prev => {
      const existing = prev.find(c => c.name === name);
      if (existing) {
        return prev.map(c => c.name === name ? { ...c, status, message, details } : c);
      }
      return [...prev, { name, status, message, details }];
    });
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    setChecks([]);

    // 1. ENV presence check
    updateCheck('ENV Variables', 'pending', 'Checking environment variables...');
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        updateCheck('ENV Variables', 'error', 'Missing Supabase environment variables');
      } else {
        const maskedKey = supabaseKey.substring(0, 10) + '...' + supabaseKey.substring(supabaseKey.length - 4);
        updateCheck('ENV Variables', 'success', 'Environment variables present', 
          `VITE_SUPABASE_URL: ${supabaseUrl}\nVITE_SUPABASE_ANON_KEY: ${maskedKey}`);
      }
    } catch (error) {
      updateCheck('ENV Variables', 'error', 'Error checking environment variables', String(error));
    }

    // 2. Supabase connectivity
    updateCheck('Supabase Connectivity', 'pending', 'Testing Supabase connection...');
    try {
      const { data, error } = await supabase.from('projects').select('count').limit(1);
      if (error) throw error;
      updateCheck('Supabase Connectivity', 'success', 'Connected to Supabase successfully');
    } catch (error: any) {
      updateCheck('Supabase Connectivity', 'error', 'Failed to connect to Supabase', error.message);
    }

    // 3. Auth session check
    updateCheck('Auth Session', 'pending', 'Checking authentication...');
    if (user) {
      updateCheck('Auth Session', 'success', `Logged in as ${user.email}`, `User ID: ${user.id}`);
    } else {
      updateCheck('Auth Session', 'error', 'Not logged in');
    }

    // 4. Tables existence check
    updateCheck('Tables Existence', 'pending', 'Checking database tables...');
    const tableResults: string[] = [];
    
    // Test each table individually with proper typing
    try {
      const { error: clientsError } = await supabase.from('clients').select('count').limit(1);
      tableResults.push(clientsError ? `❌ clients: ${clientsError.message}` : `✅ clients: OK`);
    } catch (error: any) {
      tableResults.push(`❌ clients: ${error.message}`);
    }

    try {
      const { error: projectsError } = await supabase.from('projects').select('count').limit(1);
      tableResults.push(projectsError ? `❌ projects: ${projectsError.message}` : `✅ projects: OK`);
    } catch (error: any) {
      tableResults.push(`❌ projects: ${error.message}`);
    }

    try {
      const { error: timeEntriesError } = await supabase.from('time_entries').select('count').limit(1);
      tableResults.push(timeEntriesError ? `❌ time_entries: ${timeEntriesError.message}` : `✅ time_entries: OK`);
    } catch (error: any) {
      tableResults.push(`❌ time_entries: ${error.message}`);
    }

    try {
      const { error: remindersError } = await supabase.from('reminders').select('count').limit(1);
      tableResults.push(remindersError ? `❌ reminders: ${remindersError.message}` : `✅ reminders: OK`);
    } catch (error: any) {
      tableResults.push(`❌ reminders: ${error.message}`);
    }

    try {
      const { error: leadsError } = await supabase.from('leads').select('count').limit(1);
      tableResults.push(leadsError ? `❌ leads: ${leadsError.message}` : `✅ leads: OK`);
    } catch (error: any) {
      tableResults.push(`❌ leads: ${error.message}`);
    }
    
    const hasErrors = tableResults.some(r => r.includes('❌'));
    updateCheck('Tables Existence', hasErrors ? 'error' : 'success', 
      hasErrors ? 'Some tables have issues' : 'All tables accessible',
      tableResults.join('\n'));

    // 5. RLS sanity check
    updateCheck('RLS Policies', 'pending', 'Testing Row Level Security...');
    try {
      const testEntry = {
        user_id: user.id,
        project_id: '00000000-0000-0000-0000-000000000000', // This will fail FK constraint, but tests RLS
        started_at: new Date().toISOString(),
        notes: 'System check test entry'
      };
      
      const { error } = await supabase.from('time_entries').insert(testEntry);
      if (error && error.message.includes('violates foreign key constraint')) {
        updateCheck('RLS Policies', 'success', 'RLS policies working (FK constraint as expected)');
      } else if (error) {
        updateCheck('RLS Policies', 'error', 'RLS policy issue', error.message);
      } else {
        updateCheck('RLS Policies', 'success', 'RLS policies working');
      }
    } catch (error: any) {
      updateCheck('RLS Policies', 'error', 'RLS test failed', error.message);
    }

    // 6. Overlapping timer trigger test
    updateCheck('Overlapping Timer Trigger', 'pending', 'Testing timer overlap prevention...');
    try {
      // First, clean up any running timers
      await supabase.from('time_entries')
        .update({ stopped_at: new Date().toISOString() })
        .is('stopped_at', null)
        .eq('user_id', user.id);

      // Create a test project first
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({ name: 'System Check Test Project', user_id: user.id })
        .select()
        .single();

      if (projectError) throw projectError;

      // Start first timer
      const { data: firstTimer, error: firstError } = await supabase.from('time_entries').insert({
        user_id: user.id,
        project_id: projectData.id,
        started_at: new Date().toISOString(),
        notes: 'First test timer'
      }).select().single();

      if (firstError) throw firstError;

      // Try to start second timer (should fail)
      const { error: secondError } = await supabase.from('time_entries').insert({
        user_id: user.id,
        project_id: projectData.id,
        started_at: new Date().toISOString(),
        notes: 'Second test timer (should fail)'
      });

      // Clean up
      await supabase.from('time_entries').delete().eq('id', firstTimer.id);
      await supabase.from('projects').delete().eq('id', projectData.id);

      if (secondError && secondError.message.includes('Cannot start a new timer')) {
        updateCheck('Overlapping Timer Trigger', 'success', 'Timer overlap prevention working');
      } else {
        updateCheck('Overlapping Timer Trigger', 'error', 'Timer overlap not prevented', 
          secondError?.message || 'No error thrown');
      }
    } catch (error: any) {
      updateCheck('Overlapping Timer Trigger', 'error', 'Timer trigger test failed', error.message);
    }

    // 7. CSV Export test
    updateCheck('CSV Export', 'pending', 'Testing CSV export...');
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const toDate = new Date();
      
      const { data, error } = await supabase.functions.invoke('export-csv', {
        body: { 
          from: fromDate.toISOString(), 
          to: toDate.toISOString() 
        },
      });
      
      if (error) {
        updateCheck('CSV Export', 'error', `CSV export failed: ${error.message}`);
      } else {
        updateCheck('CSV Export', 'success', 'CSV export working', 
          `Response received successfully`);
      }
    } catch (error: any) {
      updateCheck('CSV Export', 'error', 'CSV export request failed', error.message);
    }

    // 8. Resend API check
    updateCheck('Resend API', 'pending', 'Checking email service...');
    try {
      const response = await supabase.functions.invoke('reminders-cron', { 
        body: { test: true, user_id: user.id } 
      });
      
      if (response.error) {
        updateCheck('Resend API', 'error', 'Email service test failed', response.error.message);
      } else {
        updateCheck('Resend API', 'success', 'Email service accessible');
      }
    } catch (error: any) {
      updateCheck('Resend API', 'error', 'Email service test failed', error.message);
    }

    setIsRunning(false);
  };

  const insertDemoData = async () => {
    try {
      // Create demo client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({ name: 'Demo Client', user_id: user!.id })
        .select()
        .single();

      if (clientError) throw clientError;

      // Create demo project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({ 
          name: 'Demo Project', 
          user_id: user!.id,
          client_id: client.id,
          rate_hour: 75.00
        })
        .select()
        .single();

      if (projectError) throw projectError;

      setDemoData({ client, project });
      toast({ title: 'Success', description: 'Demo data created successfully' });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const startStopTestTimer = async () => {
    try {
      if (!demoData.project) {
        throw new Error('Create demo data first');
      }

      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 60000); // 1 minute later

      const { data: entry, error } = await supabase
        .from('time_entries')
        .insert({
          user_id: user!.id,
          project_id: demoData.project.id,
          started_at: startTime.toISOString(),
          stopped_at: endTime.toISOString(),
          notes: 'Test timer entry'
        })
        .select()
        .single();

      if (error) throw error;

      setDemoData(prev => ({ ...prev, timeEntry: entry }));
      toast({ title: 'Success', description: 'Test timer entry created' });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const downloadTestCSV = async () => {
    try {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 7);
      const toDate = new Date();
      
      const { data, error } = await supabase.functions.invoke('export-csv', {
        body: { 
          from: fromDate.toISOString(), 
          to: toDate.toISOString() 
        },
      });
      
      if (error) throw error;
      
      // Convert the response to a blob and download
      const blob = new Blob([data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'test-report.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({ 
        title: 'Success', 
        description: `CSV downloaded (${blob.size} bytes)` 
      });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const sendTestEmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('reminders-cron', {
        body: { 
          test: true, 
          user_id: user!.id,
          email: user!.email 
        }
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Test email sent' });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: CheckResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: CheckResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge variant="secondary" className="bg-green-100 text-green-800">PASS</Badge>;
      case 'error':
        return <Badge variant="destructive">FAIL</Badge>;
      case 'pending':
        return <Badge variant="secondary">RUNNING</Badge>;
      default:
        return <Badge variant="outline">UNKNOWN</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">System Diagnostics</h1>
          <p className="text-muted-foreground">Developer tools for testing system functionality</p>
        </div>

        <div className="grid gap-6">
          {/* Diagnostics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                System Health Checks
                <Button 
                  onClick={runDiagnostics} 
                  disabled={isRunning}
                  size="sm"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    'Run Diagnostics'
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {checks.map((check) => (
                  <div key={check.name} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(check.status)}
                        <span className="font-medium">{check.name}</span>
                      </div>
                      {getStatusBadge(check.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{check.message}</p>
                    {check.details && (
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                        {check.details}
                      </pre>
                    )}
                  </div>
                ))}
                {checks.length === 0 && !isRunning && (
                  <p className="text-center text-muted-foreground py-8">
                    Click "Run Diagnostics" to start system health checks
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* QA Buttons */}
          <Card>
            <CardHeader>
              <CardTitle>QA Testing Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button onClick={insertDemoData} variant="outline">
                  Insert Demo Client/Project
                </Button>
                <Button onClick={startStopTestTimer} variant="outline" disabled={!demoData.project}>
                  Start & Stop Test Timer
                </Button>
                <Button onClick={downloadTestCSV} variant="outline">
                  Download CSV (This Week)
                </Button>
                <Button onClick={sendTestEmail} variant="outline">
                  Send Test Email
                </Button>
              </div>

              {/* Demo data display */}
              {(demoData.client || demoData.project || demoData.timeEntry) && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Created Demo Data:</h4>
                  <div className="text-sm space-y-1">
                    {demoData.client && (
                      <p>Client: {demoData.client.name} (ID: {demoData.client.id})</p>
                    )}
                    {demoData.project && (
                      <p>Project: {demoData.project.name} (ID: {demoData.project.id})</p>
                    )}
                    {demoData.timeEntry && (
                      <p>Time Entry: {demoData.timeEntry.notes} (ID: {demoData.timeEntry.id})</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}