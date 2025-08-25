import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      // Verify webhook signature in production
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      logStep("Webhook signature verified");
    } else {
      // For testing without webhook signature
      event = JSON.parse(body);
      logStep("Webhook processed without signature verification (test mode)");
    }

    logStep("Processing event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        
        if (!userId) {
          logStep("No user_id in session metadata");
          break;
        }

        logStep("Checkout session completed", { sessionId: session.id, userId });

        // Update user's subscription status
        const { error } = await supabaseClient
          .from("profiles")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            subscription_status: "active",
            subscription_plan: "solo",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (error) {
          logStep("Error updating profile", { error: error.message });
        } else {
          logStep("Profile updated successfully");
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        logStep("Payment succeeded", { invoiceId: invoice.id, subscriptionId });

        // Get subscription details
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          const { error } = await supabaseClient
            .from("profiles")
            .update({
              subscription_status: "active",
              subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          if (error) {
            logStep("Error updating subscription status", { error: error.message });
          } else {
            logStep("Subscription status updated to active");
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = invoice.subscription as string;

        logStep("Payment failed", { invoiceId: invoice.id, subscriptionId });

        const { error } = await supabaseClient
          .from("profiles")
          .update({
            subscription_status: "past_due",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (error) {
          logStep("Error updating subscription to past_due", { error: error.message });
        } else {
          logStep("Subscription status updated to past_due");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        logStep("Subscription canceled/deleted", { subscriptionId: subscription.id });

        const { error } = await supabaseClient
          .from("profiles")
          .update({
            subscription_status: "canceled",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) {
          logStep("Error updating subscription to canceled", { error: error.message });
        } else {
          logStep("Subscription status updated to canceled");
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in stripe-webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});