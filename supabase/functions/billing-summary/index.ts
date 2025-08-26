import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to determine plan from profile
function planFromProfile(profile: any): 'free' | 'solo' | 'team' {
  const status = (profile?.stripe_subscription_status || '').toLowerCase();
  if (status === 'active' || status === 'trialing') {
    const priceId = profile?.stripe_price_id || '';
    if (priceId.includes('_TEAM_') || priceId.includes('team')) {
      return 'team';
    }
    return 'solo';
  }
  return 'free';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for auth validation
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError) {
      throw new Error(`Authentication error: ${userError.message}`);
    }

    const user = userData.user;
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Get user profile with subscription data
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('stripe_subscription_status, stripe_price_id, stripe_current_period_end')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      // Default to free if no profile found
      return new Response(JSON.stringify({
        plan: 'free',
        status: 'none',
        renewsAt: null,
        seats: null,
        priceId: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const plan = planFromProfile(profile);
    const status = profile?.stripe_subscription_status?.toLowerCase() || 'none';
    const renewsAt = profile?.stripe_current_period_end || null;
    const seats = plan === 'team' ? 1 : null; // Default to 1, can be enhanced later
    const priceId = profile?.stripe_price_id || null;

    return new Response(JSON.stringify({
      plan,
      status,
      renewsAt,
      seats,
      priceId
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Billing summary error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error),
      plan: 'free',
      status: 'none',
      renewsAt: null,
      seats: null,
      priceId: null
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});