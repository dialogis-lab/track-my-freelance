import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OnboardingState {
  project_created: boolean
  timer_started: boolean
  timer_stopped_with_note: boolean
  expense_added: boolean
  invoice_draft_created: boolean
  stripe_connected: boolean
  dismissed: boolean
  completed_at: string | null
  tour_done: boolean
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    if (req.method === 'GET') {
      // Get onboarding state
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('onboarding_state')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching onboarding state:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const state = profile?.onboarding_state as OnboardingState || {
        project_created: false,
        timer_started: false,
        timer_stopped_with_note: false,
        expense_added: false,
        invoice_draft_created: false,
        stripe_connected: false,
        dismissed: false,
        completed_at: null,
        tour_done: false,
      }

      // Check if complete
      const steps = ['project_created', 'timer_started', 'timer_stopped_with_note', 'expense_added', 'invoice_draft_created']
      const completedSteps = steps.filter(step => state[step as keyof OnboardingState]).length
      const isComplete = completedSteps === steps.length

      return new Response(JSON.stringify({ 
        state, 
        completedSteps, 
        totalSteps: steps.length,
        isComplete 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (req.method === 'PATCH') {
      // Update onboarding state
      const { updates } = await req.json()

      // Get current state
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_state')
        .eq('id', user.id)
        .single()

      const currentState = profile?.onboarding_state as OnboardingState || {}
      const newState = { ...currentState, ...updates }

      // Check if now complete
      const steps = ['project_created', 'timer_started', 'timer_stopped_with_note', 'expense_added', 'invoice_draft_created']
      const isComplete = steps.every(step => newState[step as keyof OnboardingState])
      
      if (isComplete && !newState.completed_at) {
        newState.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_state: newState })
        .eq('id', user.id)

      if (error) {
        console.error('Error updating onboarding state:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, state: newState }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders })
  } catch (error) {
    console.error('Error in onboarding-state function:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})