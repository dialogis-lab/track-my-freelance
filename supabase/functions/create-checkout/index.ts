import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started - checking environment variables");
    
    // Debug: List all environment variables (first few chars only for security)
    const allEnvs = Object.keys(Deno.env.toObject()).map(key => ({
      key,
      hasValue: !!Deno.env.get(key),
      prefix: Deno.env.get(key)?.substring(0, 4) + "..."
    }));
    logStep("All environment variables", allEnvs);
    
    // Check all required environment variables
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripePriceSolo = Deno.env.get("STRIPE_PRICE_SOLO");
    
    logStep("Environment check", { 
      stripeKeyExists: !!stripeKey,
      stripePriceSoloExists: !!stripePriceSolo,
      stripeKeyPrefix: stripeKey?.substring(0, 8) + "...",
      stripePriceValue: stripePriceSolo,
      timestamp: new Date().toISOString()
    });

    if (!stripeKey) {
      logStep("ERROR: STRIPE_SECRET_KEY missing");
      return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY is not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!stripePriceSolo) {
      logStep("ERROR: STRIPE_PRICE_SOLO missing");
      return new Response(JSON.stringify({ error: "STRIPE_PRICE_SOLO is not configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Parse request body
    const body = await req.json();
    const { plan = "solo" } = body;
    logStep("Request parsed", { plan });

    // Get user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR: Authentication failed", { error: userError.message });
      throw new Error(`Authentication error: ${userError.message}`);
    }
    
    const user = userData.user;
    if (!user?.email) {
      logStep("ERROR: No user email");
      throw new Error("User not authenticated or email not available");
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    logStep("Stripe initialized");

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      logStep("No existing customer found");
    }

    // Create checkout session
    const origin = req.headers.get("origin") || "http://localhost:3000";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: stripePriceSolo,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard`,
      metadata: {
        user_id: user.id,
        plan: plan,
      }
    });

    logStep("Checkout session created successfully", { 
      sessionId: session.id, 
      plan, 
      priceId: stripePriceSolo 
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-checkout", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});