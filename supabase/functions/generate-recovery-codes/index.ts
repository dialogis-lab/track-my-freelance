import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate 10 recovery codes
    const generateCode = (): string => {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    };

    const codes = Array.from({ length: 10 }, () => generateCode());

    // Hash codes for storage
    const hashCode = async (code: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    };

    // Delete existing recovery codes
    await supabase
      .from('mfa_recovery_codes')
      .delete()
      .eq('user_id', user.id);

    // Store new hashed codes
    const codeRecords = await Promise.all(
      codes.map(async (code) => ({
        user_id: user.id,
        code_hash: await hashCode(code),
        used: false,
      }))
    );

    const { error: insertError } = await supabase
      .from('mfa_recovery_codes')
      .insert(codeRecords);

    if (insertError) {
      throw insertError;
    }

    // Log the recovery codes regeneration
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        event_type: 'recovery_codes_regenerated',
        details: { codes_count: codes.length },
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });

    return new Response(
      JSON.stringify({ codes }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error generating recovery codes:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate recovery codes' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});