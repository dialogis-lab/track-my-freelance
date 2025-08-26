import { useState, useEffect } from 'react';
import { Loader2, CreditCard, Settings, Check, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { PLANS, type BillingSummary, type Plan } from '@/lib/plans';


interface PlanCardProps {
  title: string;
  price: string;
  cadence?: string;
  features: string[];
  isCurrent: boolean;
  isMostPopular?: boolean;
  ctaLabel: string;
  onCta: () => void;
  ctaDisabled: boolean;
  ctaLoading: boolean;
  children?: React.ReactNode;
}

function PlanCard({
  title,
  price,
  cadence,
  features,
  isCurrent,
  isMostPopular,
  ctaLabel,
  onCta,
  ctaDisabled,
  ctaLoading,
  children
}: PlanCardProps) {
  return (
    <div className="relative h-full rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {isMostPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white text-xs px-3 py-1 shadow-sm">
          Most popular
        </div>
      )}
      
      {/* FLEX COLUMN to control heights */}
      <div className="flex h-full flex-col p-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="text-lg font-semibold">{title}</div>
            {isCurrent && (
              <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-emerald-700 border-emerald-200 bg-emerald-50">
                <Check className="h-3 w-3" />
                Current
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums">{price}</span>
            {cadence && <span className="text-sm text-muted-foreground">{cadence}</span>}
          </div>
        </div>

        {/* Features take remaining height */}
        <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA sits at the bottom across all cards */}
        <div className="mt-6">
          <button
            onClick={onCta}
            disabled={ctaDisabled || ctaLoading}
            className={
              isCurrent
                ? "inline-flex h-11 w-full items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground"
                : "inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-blue-500 via-teal-500 to-green-500 px-5 text-white font-medium shadow-sm hover:opacity-95 active:opacity-90 transition"
            }
          >
            {ctaLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isCurrent ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Current Plan
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                {ctaLabel}
              </>
            )}
          </button>

          {/* Secondary actions only on current paid plan */}
          {children && (
            <div className="mt-3 flex flex-wrap gap-2">
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  const currentPlan = billingSummary?.plan || 'free';
  const isActive = billingSummary?.status === 'active' || billingSummary?.status === 'trialing';
  const isPastDue = billingSummary?.status === 'past_due';
  const isCanceling = billingSummary?.cancelAt && new Date(billingSummary.cancelAt) > new Date();

  const renderPlanCard = (planKey: Plan) => {
    const plan = PLANS[planKey];
    const isCurrentPlan = currentPlan === planKey;
    const shouldShowCurrent = isCurrentPlan && (isActive || isPastDue);
    
    // Extract price and cadence
    const [price, cadence] = planKey === 'free' 
      ? ['$0', undefined]
      : planKey === 'team_yearly'
      ? ['$190', '/year']
      : plan.priceLabel.includes('/month')
      ? plan.priceLabel.split('/')
      : [plan.priceLabel, undefined];

    const ctaLabel = isActive ? 'Change Plan' : planKey === 'free' ? 'Current Plan' : 'Get Started';

    const secondaryActions = shouldShowCurrent && planKey !== 'free' && (
      <>
        {/* Subscription status */}
        <div className="text-sm text-muted-foreground mb-2">
          {isCanceling ? (
            <p>Ends on {billingSummary?.cancelAt ? new Date(billingSummary.cancelAt).toLocaleDateString() : ''}</p>
          ) : billingSummary?.renewsAt ? (
            <p>Renews on {new Date(billingSummary.renewsAt).toLocaleDateString()}</p>
          ) : null}
        </div>

        {/* Secondary action buttons */}
        <button
          onClick={handleCustomerPortal}
          disabled={portalLoading}
          className="inline-flex h-9 items-center justify-center px-3 rounded-md border bg-background hover:bg-muted text-sm disabled:opacity-50"
        >
          {portalLoading ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Settings className="mr-2 h-3 w-3" />
          )}
          {isPastDue ? 'Fix Payment' : 'Manage Billing'}
        </button>
        
        {!isPastDue && (
          <>
            {isCanceling ? (
              <button
                onClick={handleResumeSubscription}
                disabled={resumeLoading}
                className="inline-flex h-9 items-center justify-center px-3 rounded-md border bg-background hover:bg-muted text-sm disabled:opacity-50"
              >
                {resumeLoading ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Check className="mr-2 h-3 w-3" />
                )}
                Resume
              </button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="inline-flex h-9 items-center justify-center px-3 rounded-md border bg-background hover:bg-muted text-sm">
                    <X className="mr-2 h-3 w-3" />
                    Cancel
                  </button>
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
          </>
        )}
      </>
    );
    
    return (
      <PlanCard
        key={planKey}
        title={plan.name}
        price={price}
        cadence={cadence}
        features={plan.features}
        isCurrent={shouldShowCurrent}
        isMostPopular={plan.popular}
        ctaLabel={ctaLabel}
        onCta={() => handleCheckout(planKey)}
        ctaDisabled={shouldShowCurrent}
        ctaLoading={checkoutLoading === planKey}
      >
        {secondaryActions}
      </PlanCard>
    );
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch max-w-none">
        {renderPlanCard('free')}
        {renderPlanCard('solo')}
        {renderPlanCard('team')}
        {renderPlanCard('team_yearly')}
      </div>
    </div>
  );
}