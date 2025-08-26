import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, CheckCircle, Settings } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

export function UpgradeButton() {
  const { subscription, loading, isActive, isPastDue, hasStripeCustomer, createCheckout, openCustomerPortal } = useSubscription();

  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const url = await createCheckout('solo');
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error('Upgrade error details:', error);
      toast.error(error instanceof Error ? error.message : "Failed to create checkout session. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const portalUrl = await openCustomerPortal();
      if (portalUrl) {
        window.open(portalUrl, '_blank');
      }
    } catch (error) {
      toast.error('Failed to open customer portal');
    }
  };

  if (loading) {
    return <div className="animate-pulse h-32 bg-muted rounded-lg" />;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">TimeHatch Solo</CardTitle>
            {isActive && (
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Active
              </Badge>
            )}
            {isPastDue && (
              <Badge variant="destructive">
                Past Due
              </Badge>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">CHF 9</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>
        </div>
        <CardDescription>
          Professional time tracking for freelancers and small teams
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Unlimited time tracking</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Project & client management</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Professional reports & exports</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span>Invoice generation</span>
          </div>
        </div>

        {!isActive ? (
          <Button 
            onClick={handleUpgrade} 
            className="w-full" 
            size="lg"
            disabled={isLoading}
          >
            <Crown className="h-4 w-4 mr-2" />
            {isLoading ? 'Processing...' : 'Upgrade to Solo'}
          </Button>
        ) : (
          <div className="space-y-2">
            {subscription?.subscription_current_period_end && (
              <p className="text-sm text-muted-foreground text-center">
                Next billing: {new Date(subscription.subscription_current_period_end).toLocaleDateString()}
              </p>
            )}
            {hasStripeCustomer && (
              <Button 
                onClick={handleManageSubscription} 
                variant="outline" 
                className="w-full"
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}