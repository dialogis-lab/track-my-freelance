import React, { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Crown, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { useSubscription } from '@/hooks/useSubscription';

export default function SubscriptionSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { refetch } = useSubscription();

  useEffect(() => {
    // Refetch subscription data after successful payment
    const timer = setTimeout(async () => {
      await refetch();
      // Force a page refresh to ensure timer display works correctly
      // This ensures all components are properly updated with the new subscription status
      window.location.href = '/dashboard';
    }, 3000);

    return () => clearTimeout(timer);
  }, [refetch]);

  return (
    <AppLayout>
      <div className="container max-w-2xl mx-auto py-12">
        <Card className="border-green-200">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">Welcome to TimeHatch Solo!</CardTitle>
            <CardDescription className="text-lg">
              Your subscription has been successfully activated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold text-green-800">TimeHatch Solo - CHF 9/month</h3>
              </div>
              <p className="text-green-700 text-sm">
                You now have access to all professional time tracking features including unlimited projects, 
                detailed reports, and invoice generation.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">What's included:</h4>
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
            </div>

            {sessionId && (
              <div className="text-xs text-muted-foreground">
                Session ID: {sessionId}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild className="flex-1">
                <Link to="/dashboard">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/projects">
                  Start Tracking Time
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}