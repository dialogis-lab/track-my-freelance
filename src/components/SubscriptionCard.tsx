import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Settings } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  interval: string;
  features: string[];
  popular?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: 'solo',
    name: 'Solo',
    price: '$9',
    interval: 'month',
    features: [
      'Unlimited time tracking',
      'Projects & clients',
      'Basic reports',
      'CSV export'
    ]
  },
  {
    id: 'team_monthly',
    name: 'Team',
    price: '$19',
    interval: 'month',
    features: [
      'Everything in Solo',
      'Team collaboration',
      'Advanced reports', 
      'PDF invoices',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'team_yearly',
    name: 'Team Yearly',
    price: '$190',
    interval: 'year',
    features: [
      'Everything in Team',
      '2 months free',
      'Priority support',
      'Early access to features'
    ]
  }
];

export function SubscriptionCard() {
  const { subscription, loading, isActive, createCheckout, openCustomerPortal } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleCheckout = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      const url = await createCheckout(planId as any);
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create checkout session. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCustomerPortal = async () => {
    setPortalLoading(true);
    try {
      const url = await openCustomerPortal();
      if (url) {
        window.open(url, '_blank');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open customer portal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {isActive && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-green-800">Current Subscription</CardTitle>
              <Badge variant="outline" className="bg-green-100 text-green-800">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="font-medium">{subscription?.subscription_plan || 'Solo'}</p>
                {subscription?.subscription_current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    Renews on {new Date(subscription.subscription_current_period_end).toLocaleDateString()}
                  </p>
                )}
              </div>
              <Button 
                onClick={handleCustomerPortal}
                disabled={portalLoading}
                variant="outline"
                className="w-full"
              >
                {portalLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Settings className="mr-2 h-4 w-4" />
                )}
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={`relative ${plan.popular ? 'border-primary' : ''}`}>
            {plan.popular && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="text-3xl font-bold">
                {plan.price}
                <span className="text-sm font-normal text-muted-foreground">
                  /{plan.interval}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="text-sm">
                    ✓ {feature}
                  </li>
                ))}
              </ul>
              
              {isActive && subscription?.subscription_plan?.toLowerCase().includes(plan.name.toLowerCase()) ? (
                <Badge variant="outline" className="w-full justify-center">
                  Current Plan
                </Badge>
              ) : (
                <Button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={checkoutLoading === plan.id}
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  {checkoutLoading === plan.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  {isActive ? 'Switch Plan' : 'Get Started'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}