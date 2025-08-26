import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, Settings, ArrowUpRight } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useSubscription } from '@/hooks/useSubscription';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function PlanCard() {
  const { plan, isLoading } = usePlan();
  const { createCheckout, openCustomerPortal } = useSubscription();
  const navigate = useNavigate();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const url = await createCheckout('solo');
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast.error('Failed to create checkout session');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const portalUrl = await openCustomerPortal();
      if (portalUrl) {
        window.open(portalUrl, '_blank');
      }
    } catch (error) {
      toast.error('Failed to open billing portal');
    }
  };

  if (isLoading) {
    return <div className="h-32 bg-muted animate-pulse rounded-lg" />;
  }

  if (plan === 'free') {
    return (
      <Card className="border-dashed border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Crown className="h-4 w-4 text-muted-foreground" />
            Free Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Limit: 1 client & 1 project
          </p>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="flex-1"
            >
              {upgradeLoading ? 'Processing...' : 'Upgrade'}
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => navigate('/settings')}
              className="text-xs"
            >
              See plans
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // For Solo/Team plans
  const planName = plan === 'solo' ? 'Solo' : 'Team';
  
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            {planName}
          </CardTitle>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Unlimited clients & projects
        </p>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleManageBilling}
          className="w-full"
        >
          <Settings className="h-4 w-4 mr-2" />
          Manage Billing
        </Button>
      </CardContent>
    </Card>
  );
}