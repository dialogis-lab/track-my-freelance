-- Add onboarding state to profiles table
ALTER TABLE public.profiles 
ADD COLUMN onboarding_state JSONB DEFAULT '{"project_created": false, "timer_started": false, "timer_stopped_with_note": false, "expense_added": false, "invoice_draft_created": false, "stripe_connected": false, "dismissed": false, "completed_at": null, "tour_done": false}';