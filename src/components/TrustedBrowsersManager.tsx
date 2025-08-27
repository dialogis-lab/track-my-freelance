import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Smartphone, Monitor, Trash2, AlertTriangle } from 'lucide-react';

interface TrustedDevice {
  id: string;
  device_id: string;
  ua_hash: string;
  ip_prefix: any; // Use any to handle the INET type from PostgreSQL
  created_at: string;
  last_seen_at: string;
  expires_at: string;
}

export function TrustedBrowsersManager() {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadTrustedDevices();
  }, []);

  const loadTrustedDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trusted_devices')
        .select('*')
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error('Error loading trusted devices:', error);
      toast({
        title: "Error",
        description: "Failed to load trusted browsers.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.functions.invoke('trusted-device', {
        body: { action: 'revoke', device_id: deviceId },
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setDevices(devices.filter(device => device.device_id !== deviceId));
      
      toast({
        title: "Browser Revoked",
        description: "The trusted browser has been removed.",
      });
    } catch (error: any) {
      console.error('Error revoking device:', error);
      toast({
        title: "Error",
        description: "Failed to revoke browser access.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeAllDevices = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.functions.invoke('trusted-device', {
        body: { action: 'revoke_all' },
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setDevices([]);
      
      toast({
        title: "All Browsers Revoked",
        description: "All trusted browsers have been removed.",
      });
    } catch (error: any) {
      console.error('Error revoking all devices:', error);
      toast({
        title: "Error",
        description: "Failed to revoke all browsers.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDeviceIcon = (uaHash: string) => {
    // Simple heuristic based on user agent hash patterns
    // In practice, you might store more device info
    return <Monitor className="w-4 h-4" />;
  };

  const getDeviceName = (uaHash: string, ipPrefix: any) => {
    // Extract basic info from stored data
    // In practice, you might want to store the original user agent string (encrypted)
    return `Browser from ${String(ipPrefix)}`;
  };

  if (loading && devices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trusted Browsers</CardTitle>
          <CardDescription>Loading trusted browsers...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trusted Browsers</CardTitle>
        <CardDescription>
          Manage browsers that can skip two-factor authentication for 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {devices.length === 0 ? (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              No trusted browsers found. Use the "Remember this browser" option during MFA to add browsers.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getDeviceIcon(device.ua_hash)}
                    <div>
                      <p className="font-medium">{getDeviceName(device.ua_hash, device.ip_prefix)}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>Added: {formatDate(device.created_at)}</span>
                        <span>•</span>
                        <span>Last used: {formatDate(device.last_seen_at)}</span>
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        {isExpired(device.expires_at) ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge variant="secondary">
                            Expires: {formatDate(device.expires_at)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeDevice(device.device_id)}
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                onClick={revokeAllDevices}
                disabled={loading || devices.length === 0}
              >
                Revoke All Trusted Browsers
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will require MFA verification on all browsers.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}