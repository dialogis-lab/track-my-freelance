import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WaitlistRequest {
  email: string;
  honeypot?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('Secure waitlist signup request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed. Use POST.' }),
      { 
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get client IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || '127.0.0.1';
    console.log(`Request from IP: ${ip}`);

    const { email, honeypot }: WaitlistRequest = await req.json();

    // 1. Honeypot spam protection
    if (honeypot && honeypot.trim() !== '') {
      console.log('Honeypot triggered - potential spam');
      // Return success to avoid revealing spam detection
      return new Response(
        JSON.stringify({ success: true, message: 'Added to waitlist' }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // 2. Input validation
    if (!email || !email.trim()) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // 3. Rate limiting check
    const { data: rateLimitResult, error: rateLimitError } = await supabase
      .rpc('check_waitlist_rate_limit', {
        p_ip_address: ip,
        p_email: email.toLowerCase().trim()
      });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      return new Response(
        JSON.stringify({ error: 'Server error. Please try again later.' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    if (rateLimitResult && rateLimitResult.length > 0 && !rateLimitResult[0].allowed) {
      console.log('Rate limit exceeded:', rateLimitResult[0].reason);
      return new Response(
        JSON.stringify({ error: rateLimitResult[0].reason }),
        { 
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // 4. Check if email already exists
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('email')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Database check error:', checkError);
      return new Response(
        JSON.stringify({ error: 'Server error. Please try again later.' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    if (existingLead) {
      console.log('Email already exists in waitlist');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'You\'re already on our waitlist! We\'ll notify you when TimeHatch is ready.',
          alreadyExists: true
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // 5. Add to waitlist
    const { data: insertResult, error: insertError } = await supabase
      .from('leads')
      .insert([{ email: email.toLowerCase().trim() }])
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to add to waitlist. Please try again.' }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    console.log('Successfully added to waitlist:', email);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Successfully added to waitlist! We\'ll notify you when TimeHatch is ready.',
        data: insertResult 
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );

  } catch (error: any) {
    console.error('Unexpected error in secure waitlist signup:', error);
    return new Response(
      JSON.stringify({ error: 'Server error. Please try again later.' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
};

serve(handler);