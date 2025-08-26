import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { 
  validateEncryptionConfig, 
  getWorkspaceDEK, 
  encryptField,
  hmacFingerprint
} from '../workspace-crypto/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackfillStats {
  profiles: number;
  clients: number;
  time_entries: number;
  expenses: number;
  invoices: number;
  errors: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Validate encryption configuration
    const config = validateEncryptionConfig();
    if (!config.valid) {
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error',
          details: config.error 
        }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Missing authorization header', { status: 401, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Check if user is admin (simplified check for now)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || userRole.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stats: BackfillStats = {
      profiles: 0,
      clients: 0,
      time_entries: 0,
      expenses: 0,
      invoices: 0,
      errors: []
    };

    console.log('Starting encryption backfill...');

    // Backfill profiles
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, bank_details, vat_id, company_name, address')
        .or('bank_details_enc.is.null,vat_id_enc.is.null')
        .not('bank_details', 'is', null)
        .or('vat_id', 'is', 'not.null');

      if (profiles) {
        for (const profile of profiles) {
          try {
            const workspaceId = profile.id; // user_id as workspace_id
            const updateData: any = {};

            // Encrypt bank_details if not already encrypted
            if (profile.bank_details && !profile.bank_details.startsWith('enc:')) {
              updateData.bank_details_enc = await encryptField(supabase, workspaceId, profile.bank_details);
              updateData.bank_details = null;
              
              // Generate IBAN fingerprint
              try {
                const normalizedIban = profile.bank_details.replace(/\s/g, '').toUpperCase();
                if (normalizedIban.match(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/)) {
                  const fp = await hmacFingerprint(normalizedIban);
                  updateData.iban_fp = Array.from(fp);
                }
              } catch (fpError) {
                console.error('IBAN fingerprint error:', fpError);
              }
            }

            // Encrypt vat_id if not already encrypted
            if (profile.vat_id && !profile.vat_id.startsWith('enc:')) {
              updateData.vat_id_enc = await encryptField(supabase, workspaceId, profile.vat_id);
              updateData.vat_id = null;
              
              // Generate VAT fingerprint
              try {
                const fp = await hmacFingerprint(profile.vat_id);
                updateData.vat_fp = Array.from(fp);
              } catch (fpError) {
                console.error('VAT fingerprint error:', fpError);
              }
            }

            if (Object.keys(updateData).length > 0) {
              await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', profile.id);
              
              stats.profiles++;
            }
          } catch (error) {
            console.error(`Profile ${profile.id} encryption failed:`, error);
            stats.errors.push(`Profile ${profile.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Profiles backfill error:', error);
      stats.errors.push(`Profiles: ${error.message}`);
    }

    // Backfill clients
    try {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, user_id, email, contact_person, phone, notes, tax_number')
        .or('email_fp.is.null,tax_id_fp.is.null')
        .or('email.is.not.null,tax_number.is.not.null');

      if (clients) {
        for (const client of clients) {
          try {
            const workspaceId = client.user_id; // user_id as workspace_id
            const updateData: any = {};

            // Encrypt and fingerprint email
            if (client.email && client.email.trim()) {
              const fp = await hmacFingerprint(client.email);
              updateData.email_fp = Array.from(fp);
            }

            // Encrypt and fingerprint tax_number
            if (client.tax_number && client.tax_number.trim()) {
              const fp = await hmacFingerprint(client.tax_number);
              updateData.tax_id_fp = Array.from(fp);
            }

            if (Object.keys(updateData).length > 0) {
              await supabase
                .from('clients')
                .update(updateData)
                .eq('id', client.id);
              
              stats.clients++;
            }
          } catch (error) {
            console.error(`Client ${client.id} encryption failed:`, error);
            stats.errors.push(`Client ${client.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Clients backfill error:', error);
      stats.errors.push(`Clients: ${error.message}`);
    }

    // Log the backfill operation
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'encryption_backfill',
      details: {
        stats,
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });

    console.log('Encryption backfill completed:', stats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Encryption backfill completed',
        stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Backfill error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Backfill failed', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});