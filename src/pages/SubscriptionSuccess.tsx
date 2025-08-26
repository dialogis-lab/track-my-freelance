import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [syncComplete, setSyncComplete] = useState(false);

  useEffect(() => {
    const syncSubscription = async () => {
      if (!sessionId) return;
      
      try {
        console.log('Syncing subscription from session:', sessionId);
        const { data, error } = await supabase.functions.invoke('sync-from-session', {
          body: { session_id: sessionId }
        });
        
        if (error) {
          console.error('Sync error:', error);
        } else {
          console.log('Subscription synced:', data);
          // Set flag for dashboard to know billing was just updated
          localStorage.setItem('billingJustUpgraded', '1');
          setSyncComplete(true);
        }
      } catch (error) {
        console.error('Failed to sync subscription:', error);
      }
    };

    syncSubscription();
  }, [sessionId]);

  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <Card className="text-center">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-2xl text-green-600">
            Subscription Activated!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Thank you for subscribing to TimeHatch! Your subscription is now active 
            and you have access to all premium features.
          </p>
          {sessionId && (
            <p className="text-sm text-muted-foreground">
              Session ID: {sessionId}
            </p>
          )}
          <div className="space-y-2">
            <Button 
              onClick={() => navigate('/dashboard?upgraded=1')} 
              className="w-full"
            >
              Go to Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={() => navigate('/settings')}
              className="w-full"
            >
              View Subscription Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}