import { SubscriptionCard } from '@/components/SubscriptionCard';

export function SettingsSubscription() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Subscription</h2>
        <p className="text-muted-foreground">
          Manage your TimeHatch subscription and billing.
        </p>
      </div>
      
      <SubscriptionCard />
    </div>
  );
}