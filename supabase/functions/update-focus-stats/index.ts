import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateFocusStatsRequest {
  user_id: string;
  focus_minutes: number;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, focus_minutes }: UpdateFocusStatsRequest = await req.json();

    if (!user_id || !focus_minutes) {
      throw new Error('Missing required fields');
    }

    const today = new Date().toISOString().split('T')[0];

    // Upsert focus stats for today
    const { data, error } = await supabase
      .from('focus_stats')
      .upsert({
        user_id,
        date: today,
        sessions: 1,
        focus_minutes: Math.floor(focus_minutes)
      }, {
        onConflict: 'user_id,date',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (error) {
      // If upsert failed, try to increment existing record
      const { data: existingData, error: selectError } = await supabase
        .from('focus_stats')
        .select('sessions, focus_minutes')
        .eq('user_id', user_id)
        .eq('date', today)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        throw selectError;
      }

      if (existingData) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('focus_stats')
          .update({
            sessions: existingData.sessions + 1,
            focus_minutes: existingData.focus_minutes + Math.floor(focus_minutes)
          })
          .eq('user_id', user_id)
          .eq('date', today);

        if (updateError) throw updateError;
      } else {
        // Create new record
        const { error: insertError } = await supabase
          .from('focus_stats')
          .insert({
            user_id,
            date: today,
            sessions: 1,
            focus_minutes: Math.floor(focus_minutes)
          });

        if (insertError) throw insertError;
      }
    }

    console.log(`Updated focus stats for user ${user_id}: +1 session, +${focus_minutes} minutes`);

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error("Error in update-focus-stats function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);