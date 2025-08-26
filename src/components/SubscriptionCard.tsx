import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, Settings, Check, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PLANS, type BillingSummary } from '@/lib/plans';


export function SubscriptionCard() {
  const { user } = useAuth();
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);

  const fetchBillingSummary = async () => {
    if (!user) {
      setBillingSummary(null);
      setLoading(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('billing-summary', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      setBillingSummary(data);
    } catch (error) {
      console.error('Error fetching billing summary:', error);
      setBillingSummary({
        plan: 'free',
        status: 'none',
        renewsAt: null,
        cancelAt: null,
        seats: null,
        priceId: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (planKey: string) => {
    if (!user) return;
    
    setCheckoutLoading(planKey);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: planKey },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) {
        if (error.message?.includes('409') || error.status === 409) {
          // Redirect to portal if already has subscription
          const portalUrl = await handleCustomerPortal();
          if (portalUrl) window.open(portalUrl, '_blank');
          return;
        }
        throw error;
      }
      
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create checkout session.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCustomerPortal = async () => {
    if (!user) return null;
    
    setPortalLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, '_blank');
        return data.url;
      }
      return null;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to open customer portal.",
        variant: "destructive",
      });
      return null;
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('subscription-cancel', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      toast({
        title: "Subscription Cancelled",
        description: `Your subscription will end on ${new Date(data.cancelAt).toLocaleDateString()}`,
      });
      
      fetchBillingSummary(); // Refresh data
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel subscription.",
        variant: "destructive",
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleResumeSubscription = async () => {
    setResumeLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('subscription-resume', {
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (error) throw error;
      
      toast({
        title: "Subscription Resumed",
        description: `Your subscription will renew on ${new Date(data.renewsAt).toLocaleDateString()}`,
      });
      
      fetchBillingSummary(); // Refresh data
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to resume subscription.",
        variant: "destructive",
      });
    } finally {
      setResumeLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingSummary();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const currentPlan = billingSummary?.plan || 'free';
  const isActive = billingSummary?.status === 'active' || billingSummary?.status === 'trialing';
  const isPastDue = billingSummary?.status === 'past_due';
  const isCanceling = billingSummary?.cancelAt && new Date(billingSummary.cancelAt) > new Date();

  const renderPlanCard = (planKey: keyof typeof PLANS) => {
    const plan = PLANS[planKey];
    const isCurrentPlan = currentPlan === planKey;
    const shouldShowCurrent = isCurrentPlan && (isActive || isPastDue);
    
    return (
      <Card key={planKey} className={`relative ${plan.popular ? 'border-primary' : ''} ${shouldShowCurrent ? 'border-green-200 bg-green-50' : ''}`}>
        {plan.popular && (
          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
            Most Popular
          </Badge>
        )}
        {shouldShowCurrent && (
          <Badge variant="outline" className="absolute -top-2 right-4 bg-green-100 text-green-800">
            Current
          </Badge>
        )}
        
        <CardHeader>
          <CardTitle className={shouldShowCurrent ? 'text-green-800' : ''}>{plan.name}</CardTitle>
          <div className={`text-3xl font-bold ${shouldShowCurrent ? 'text-green-800' : ''}`}>
            {plan.priceLabel}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {plan.features.map((feature, index) => (
              <li key={index} className="text-sm flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                {feature}
              </li>
            ))}
          </ul>

          {/* Subscription status info */}
          {shouldShowCurrent && (
            <div className="text-sm text-muted-foreground">
              {isCanceling ? (
                <p>Ends on {billingSummary?.cancelAt ? new Date(billingSummary.cancelAt).toLocaleDateString() : ''}</p>
              ) : billingSummary?.renewsAt ? (
                <p>Renews on {new Date(billingSummary.renewsAt).toLocaleDateString()}</p>
              ) : null}
            </div>
          )}

          {/* Primary button */}
          {shouldShowCurrent ? (
            <Button disabled className="w-full" variant="outline">
              <Check className="mr-2 h-4 w-4" />
              Current Plan
            </Button>
          ) : (
            <Button
              onClick={() => handleCheckout(planKey)}
              disabled={!!checkoutLoading}
              className="w-full"
              variant={plan.popular ? "default" : "outline"}
            >
              {checkoutLoading === planKey ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {isActive ? 'Change Plan' : planKey === 'free' ? 'Current Plan' : 'Get Started'}
            </Button>
          )}

          {/* Secondary buttons for current paid plan */}
          {shouldShowCurrent && planKey !== 'free' && (
            <div className="space-y-2">
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
                {isPastDue ? 'Fix Payment' : 'Manage Billing'}
              </Button>
              
              {!isPastDue && (
                <div className="flex gap-2">
                  {isCanceling ? (
                    <Button 
                      onClick={handleResumeSubscription}
                      disabled={resumeLoading}
                      variant="outline"
                      className="flex-1"
                    >
                      {resumeLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      Resume
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="flex-1">
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                          <AlertDialogDescription>
                            Your subscription will remain active until the end of your billing period on{' '}
                            {billingSummary?.renewsAt ? new Date(billingSummary.renewsAt).toLocaleDateString() : 'the end of the period'}.
                            You can resume anytime before then.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleCancelSubscription}
                            disabled={cancelLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {cancelLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Cancel Subscription
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {renderPlanCard('free')}
      {renderPlanCard('solo')}
      {renderPlanCard('team')}
      {renderPlanCard('team_yearly')}
    </div>
  );
}