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
  device_name: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
}

export function TrustedDevicesManager() {
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
        .from('mfa_trusted_devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error('Error loading trusted devices:', error);
      toast({
        title: "Error",
        description: "Failed to load trusted devices.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('mfa_trusted_devices')
        .delete()
        .eq('id', deviceId);

      if (error) throw error;

      // Log the device revocation
      await supabase
        .from('audit_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          event_type: 'trusted_device_revoked',
          details: { device_id: deviceId }
        });

      setDevices(devices.filter(device => device.id !== deviceId));
      
      toast({
        title: "Device Revoked",
        description: "The trusted device has been removed.",
      });
    } catch (error: any) {
      console.error('Error revoking device:', error);
      toast({
        title: "Error",
        description: "Failed to revoke device access.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const revokeAllDevices = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('mfa_trusted_devices')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      // Log the action
      await supabase
        .from('audit_logs')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          event_type: 'all_trusted_devices_revoked',
          details: { devices_count: devices.length }
        });

      setDevices([]);
      
      toast({
        title: "All Devices Revoked",
        description: "All trusted devices have been removed.",
      });
    } catch (error: any) {
      console.error('Error revoking all devices:', error);
      toast({
        title: "Error",
        description: "Failed to revoke all devices.",
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

  const getDeviceIcon = (deviceName: string) => {
    if (deviceName.toLowerCase().includes('mobile')) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  if (loading && devices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trusted Devices</CardTitle>
          <CardDescription>Loading trusted devices...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trusted Devices</CardTitle>
        <CardDescription>
          Manage devices that can skip two-factor authentication for 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {devices.length === 0 ? (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              No trusted devices found. Use the "Remember this device" option during MFA to add devices.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getDeviceIcon(device.device_name)}
                    <div>
                      <p className="font-medium">{device.device_name}</p>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span>Added: {formatDate(device.created_at)}</span>
                        <span>•</span>
                        <span>Last used: {formatDate(device.last_used_at)}</span>
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
                    onClick={() => revokeDevice(device.id)}
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
                Revoke All Trusted Devices
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                This will require MFA verification on all devices.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}