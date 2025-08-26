export type Plan = 'free' | 'solo' | 'team';

export function planFromProfile(p?: {
  stripe_subscription_status?: string | null;
  stripe_price_id?: string | null;
}): Plan {
  const status = (p?.stripe_subscription_status || '').toLowerCase();
  if (status === 'active' || status === 'trialing') {
    // Naive mapping by price id prefix; refine if you store plan explicitly
    const priceId = p?.stripe_price_id || '';
    if (priceId.includes('_TEAM_') || priceId.includes('team')) {
      return 'team';
    }
    return 'solo';
  }
  return 'free';
}

export const PLAN_LIMITS = {
  free: {
    clients: 1,
    projects: 1,
    seats: 1,
  },
  solo: {
    clients: Infinity,
    projects: Infinity,
    seats: 1,
  },
  team: {
    clients: Infinity,
    projects: Infinity,
    seats: Infinity,
  },
} as const;

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}