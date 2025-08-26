import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-FROM-SESSION] ${step}${detailsStr}`);
};

// Helper function to determine plan from price ID
function getPlanFromPriceId(priceId: string): 'solo' | 'team' {
  if (priceId.includes('_TEAM_') || priceId.includes('team')) {
    return 'team';
  }
  return 'solo';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    // Use service role key to bypass RLS for updates
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");
    logStep("Session ID provided", { session_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    
    // Retrieve the checkout session with expanded subscription data
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription', 'subscription.items.data.price']
    });
    
    if (!session.subscription) {
      throw new Error("No subscription found in checkout session");
    }
    
    const subscription = session.subscription as Stripe.Subscription;
    const customerId = session.customer as string;
    const subscriptionId = subscription.id;
    const status = subscription.status;
    const currentPeriodEnd = subscription.current_period_end;
    
    // Get price info from first line item
    const firstItem = subscription.items.data[0];
    const priceId = firstItem.price.id;
    const quantity = firstItem.quantity || 1;
    
    logStep("Subscription data retrieved", {
      subscriptionId,
      status,
      priceId,
      quantity,
      currentPeriodEnd
    });

    // Update profiles table with subscription info
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_subscription_status: status,
        stripe_price_id: priceId,
        stripe_current_period_end: new Date(currentPeriodEnd * 1000).toISOString(),
        stripe_seat_quantity: quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      logStep("ERROR updating profile", updateError);
      throw new Error(`Failed to update profile: ${updateError.message}`);
    }

    logStep("Profile updated successfully");

    // Determine plan and build response
    const plan = getPlanFromPriceId(priceId);
    const renewsAt = new Date(currentPeriodEnd * 1000).toISOString();
    const seats = plan === 'team' ? quantity : null;

    const response = {
      plan,
      status,
      renewsAt,
      seats,
      priceId
    };

    logStep("Sync completed", response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in sync-from-session", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});