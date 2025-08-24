import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';
import { Resend } from "npm:resend@4.0.0";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Profile {
  id: string;
  email: string;
  display_name?: string;
}

interface Reminder {
  id: string;
  user_id: string;
  cadence: 'daily' | 'weekly';
  hour_local: number;
  enabled: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting reminder cron job...');

    // Get current hour in UTC
    const now = new Date();
    const currentHour = now.getUTCHours();
    
    // For weekly reminders, check if it's Monday (1 in getUTCDay)
    const isMonday = now.getUTCDay() === 1;

    // Get active reminders for the current hour
    let reminderQuery = supabase
      .from('reminders')
      .select('*')
      .eq('enabled', true)
      .eq('hour_local', currentHour);

    // For weekly reminders, only send on Mondays
    if (isMonday) {
      reminderQuery = reminderQuery.in('cadence', ['daily', 'weekly']);
    } else {
      reminderQuery = reminderQuery.eq('cadence', 'daily');
    }

    const { data: reminders, error: remindersError } = await reminderQuery;

    if (remindersError) {
      throw remindersError;
    }

    console.log(`Found ${reminders?.length || 0} reminders to process`);

    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No reminders to send at this time',
        processed: 0 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get user profiles for the reminders
    const userIds = reminders.map(r => r.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', userIds);

    if (profilesError) {
      throw profilesError;
    }

    let emailsSent = 0;
    const errors: string[] = [];

    // Send emails
    for (const reminder of reminders) {
      const profile = profiles?.find(p => p.id === reminder.user_id);
      
      if (!profile?.email) {
        console.warn(`No email found for user ${reminder.user_id}`);
        continue;
      }

      try {
        const subject = reminder.cadence === 'daily' 
          ? 'Daily Time Tracking Reminder' 
          : 'Weekly Time Tracking Reminder';

        const greeting = profile.display_name ? `Hi ${profile.display_name}` : 'Hi there';
        
        const content = reminder.cadence === 'daily'
          ? `${greeting},\n\nThis is your daily reminder to track your time in TimeHatch.\n\nDon't forget to log your work hours to keep your projects on track!\n\nBest regards,\nThe TimeHatch Team`
          : `${greeting},\n\nThis is your weekly reminder to review your time tracking in TimeHatch.\n\nTake a moment to:\n- Review your logged hours from last week\n- Check if any entries are missing\n- Generate reports for your clients\n\nBest regards,\nThe TimeHatch Team`;

        const emailResponse = await resend.emails.send({
          from: 'TimeHatch <reminders@resend.dev>',
          to: [profile.email],
          subject,
          text: content,
        });

        if (emailResponse.error) {
          errors.push(`Failed to send to ${profile.email}: ${emailResponse.error.message}`);
        } else {
          emailsSent++;
          console.log(`Reminder sent to ${profile.email}`);
        }
      } catch (error) {
        const errorMsg = `Error sending to ${profile.email}: ${error.message}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    const result = {
      success: true,
      processed: reminders.length,
      emailsSent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: now.toISOString(),
    };

    console.log('Cron job completed:', result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error) {
    console.error('Error in reminders cron:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
};

serve(handler);