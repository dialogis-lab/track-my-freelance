export type Plan = 'free' | 'solo' | 'team' | 'team_yearly';

export interface PlanConfig {
  key: Plan;
  name: string;
  priceLabel: string;
  priceId?: string;
  features: string[];
  popular?: boolean;
}

export const PLANS: Record<Plan, PlanConfig> = {
  free: {
    key: 'free',
    name: 'Free',
    priceLabel: '$0',
    features: ['1 client', '1 project', 'Basic tracking']
  },
  solo: {
    key: 'solo',
    name: 'Solo',
    priceLabel: '$9/month',
    priceId: 'price_solo_month', // Will be replaced with actual Stripe price ID
    features: ['Unlimited time tracking', 'Projects & clients', 'Basic reports', 'CSV export']
  },
  team: {
    key: 'team',
    name: 'Team',
    priceLabel: '$19/month',
    priceId: 'price_team_month',
    features: ['Everything in Solo', 'Team collaboration', 'Advanced reports', 'PDF invoices', 'Priority support'],
    popular: true
  },
  team_yearly: {
    key: 'team_yearly',
    name: 'Team Yearly',
    priceLabel: '$190/year',
    priceId: 'price_team_year',
    features: ['Everything in Team', '2 months free', 'Priority support', 'Early access to features']
  }
} as const;

export interface BillingSummary {
  plan: Plan;
  status: 'active' | 'trialing' | 'canceled' | 'past_due' | 'incomplete' | 'none';
  renewsAt: string | null;
  cancelAt: string | null;
  seats: number | null;
  priceId: string | null;
}