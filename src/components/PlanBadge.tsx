import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

export function PlanBadge() {
  const { plan, isLoading } = usePlan();
  const { subscription, createCheckout } = useSubscription();
  const [upgradeLoading, setUpgradeLoading] = useState(false);

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const response = await createCheckout('solo');
      if (typeof response === 'string') {
        window.open(response, '_blank');
      } else if (response && 'portalUrl' in response) {
        window.open(response.portalUrl, '_blank');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      if (error.status === 409 && error.portalUrl) {
        window.open(error.portalUrl, '_blank');
      } else {
        toast.error('Failed to create checkout session');
      }
    } finally {
      setUpgradeLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-6 w-32 bg-muted animate-pulse rounded-full" />
      </div>
    );
  }

  if (plan === 'free') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] sm:text-xs text-muted-foreground bg-background">
          Free plan • 1 client & 1 project
        </span>
        <button 
          onClick={handleUpgrade}
          disabled={upgradeLoading}
          className="h-7 px-3 rounded-md text-[11px] sm:text-xs font-medium text-white bg-gradient-to-r from-blue-500 via-teal-500 to-green-500 hover:from-blue-600 hover:via-teal-600 hover:to-green-600 transition-colors"
        >
          {upgradeLoading ? 'Processing...' : 'Upgrade'}
        </button>
      </div>
    );
  }

  // For Solo/Team plans
  const planLabel = plan === 'solo' ? 'Solo' : 'Team';
  const statusLabel = 'active';
  const renewText = subscription?.subscription_current_period_end 
    ? ` • renews ${new Date(subscription.subscription_current_period_end).toLocaleDateString()}`
    : '';

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs text-muted-foreground bg-background">
        {planLabel} • {statusLabel}{renewText}
      </span>
    </div>
  );
}