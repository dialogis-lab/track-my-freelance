import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { refetch } = useSubscription();

  useEffect(() => {
    if (sessionId) {
      // Refresh subscription status after successful payment
      setTimeout(() => {
        refetch();
      }, 2000);
    }
  }, [sessionId, refetch]);

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
              onClick={() => navigate('/dashboard')} 
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