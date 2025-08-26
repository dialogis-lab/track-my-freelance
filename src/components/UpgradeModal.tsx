import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Crown, Check } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

export function UpgradeModal({ 
  open, 
  onOpenChange, 
  title = "Upgrade Required",
  description = "You've reached the Free plan limits. Upgrade to unlock more features."
}: UpgradeModalProps) {
  const { createCheckout } = useSubscription();
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (plan: 'solo' | 'team_monthly' | 'team_yearly') => {
    setLoading(plan);
    try {
      const url = await createCheckout(plan);
      if (url) {
        window.open(url, '_blank');
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {/* Solo Plan */}
          <Card className="relative border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Solo
                <Badge variant="outline">Most Popular</Badge>
              </CardTitle>
              <div className="text-3xl font-bold">
                $9
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <CardDescription>Perfect for freelancers and solo professionals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Unlimited clients & projects
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Advanced reporting
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  CSV & PDF export
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Invoice generation
                </li>
              </ul>
              <Button
                onClick={() => handleUpgrade('solo')}
                disabled={loading === 'solo'}
                className="w-full"
              >
                {loading === 'solo' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 h-4 w-4" />
                )}
                Upgrade to Solo
              </Button>
            </CardContent>
          </Card>

          {/* Team Monthly */}
          <Card className="relative">
            <CardHeader>
              <CardTitle>Team Monthly</CardTitle>
              <div className="text-3xl font-bold">
                $19
                <span className="text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <CardDescription>For growing teams and agencies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Everything in Solo
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Team collaboration
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Advanced reports
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Priority support
                </li>
              </ul>
              <Button
                onClick={() => handleUpgrade('team_monthly')}
                disabled={loading === 'team_monthly'}
                variant="outline"
                className="w-full"
              >
                {loading === 'team_monthly' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 h-4 w-4" />
                )}
                Upgrade to Team
              </Button>
            </CardContent>
          </Card>

          {/* Team Yearly */}
          <Card className="relative">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Team Yearly
                <Badge variant="secondary">Save 17%</Badge>
              </CardTitle>
              <div className="text-3xl font-bold">
                $190
                <span className="text-sm font-normal text-muted-foreground">/year</span>
              </div>
              <CardDescription>Best value for established teams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Everything in Team
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  2 months free
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Early access to features
                </li>
              </ul>
              <Button
                onClick={() => handleUpgrade('team_yearly')}
                disabled={loading === 'team_yearly'}
                variant="outline"
                className="w-full"
              >
                {loading === 'team_yearly' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="mr-2 h-4 w-4" />
                )}
                Upgrade to Team Yearly
              </Button>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}