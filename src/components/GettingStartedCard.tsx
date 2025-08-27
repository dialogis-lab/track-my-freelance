import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, X, Plus, Timer, FileText, Receipt, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface OnboardingState {
  project_created: boolean;
  timer_started: boolean;
  timer_stopped_with_note: boolean;
  expense_added: boolean;
  invoice_draft_created: boolean;
  stripe_connected: boolean;
  dismissed: boolean;
  completed_at: string | null;
  tour_done: boolean;
}

interface OnboardingData {
  state: OnboardingState;
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
}

export function GettingStartedCard() {
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const loadOnboardingState = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('onboarding-state');
      if (error) throw error;
      setOnboardingData(data);
    } catch (error) {
      console.error('Error loading onboarding state:', error);
    }
  };

  const updateOnboardingState = async (updates: Partial<OnboardingState>) => {
    try {
      const { error } = await supabase.functions.invoke('onboarding-state', {
        body: { updates }
      });
      if (error) throw error;
      await loadOnboardingState();
    } catch (error) {
      console.error('Error updating onboarding state:', error);
    }
  };

  const createDemoData = async () => {
    setIsCreatingDemo(true);
    try {
      // Create demo client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          name: 'Demo Client',
          company_name: 'Demo Company',
          email: 'demo@example.com',
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (clientError) throw clientError;

      // Create demo project
      const { error: projectError } = await supabase
        .from('projects')
        .insert({
          name: 'Demo Project',
          client_id: client.id,
          rate_hour: 75,
          user_id: (await supabase.auth.getUser()).data.user?.id
        });

      if (projectError) throw projectError;

      toast({
        title: 'Demo data created',
        description: 'Demo client and project have been created successfully.'
      });

      await loadOnboardingState();
    } catch (error) {
      console.error('Error creating demo data:', error);
      toast({
        title: 'Error',
        description: 'Failed to create demo data.',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingDemo(false);
    }
  };

  useEffect(() => {
    loadOnboardingState();
  }, []);

  if (!onboardingData || onboardingData.state.dismissed || onboardingData.isComplete) {
    return null;
  }

  const steps = [
    {
      key: 'project_created',
      title: 'Create your first project',
      description: 'Set up a project to track time',
      icon: Plus,
      action: () => navigate('/projects'),
      completed: onboardingData.state.project_created
    },
    {
      key: 'timer_started',
      title: 'Start your first timer',
      description: 'Begin tracking time on a project',
      icon: Timer,
      action: () => {},
      completed: onboardingData.state.timer_started
    },
    {
      key: 'timer_stopped_with_note',
      title: 'Stop timer with notes',
      description: 'Add notes to your time entry',
      icon: FileText,
      action: () => {},
      completed: onboardingData.state.timer_stopped_with_note
    },
    {
      key: 'expense_added',
      title: 'Add an expense',
      description: 'Track project expenses',
      icon: Receipt,
      action: () => navigate('/projects'),
      completed: onboardingData.state.expense_added
    },
    {
      key: 'invoice_draft_created',
      title: 'Create invoice draft',
      description: 'Generate your first invoice',
      icon: CreditCard,
      action: () => navigate('/invoices'),
      completed: onboardingData.state.invoice_draft_created
    }
  ];

  const progressPercentage = (onboardingData.completedSteps / onboardingData.totalSteps) * 100;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Getting Started</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => updateOnboardingState({ dismissed: true })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{onboardingData.completedSteps} of {onboardingData.totalSteps} completed</span>
            <span>{Math.round(progressPercentage)}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step) => {
          const IconComponent = step.icon;
          return (
            <div
              key={step.key}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
              onClick={step.action}
            >
              <div className={`p-1 rounded-full ${step.completed ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                {step.completed ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <IconComponent className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.completed ? 'text-muted-foreground line-through' : ''}`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
        
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={createDemoData}
            disabled={isCreatingDemo}
            className="w-full"
          >
            {isCreatingDemo ? 'Creating...' : 'Create Demo Data'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}