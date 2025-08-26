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

interface ProfileSaveRequest {
  company_name?: string;
  address?: string;
  bank_details?: string;
  vat_id?: string;
  logo_url?: string;
  test_encryption?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body first to check if this is a test request
    const body: ProfileSaveRequest = await req.json();

    // Handle health check test requests
    if (body.test_encryption === 'health_check') {
      const encryptionCheck = validateEncryptionConfig();
      if (!encryptionCheck.valid) {
        return new Response(
          JSON.stringify({ 
            error: 'Server configuration error', 
            message: encryptionCheck.error,
            adminAction: 'Configure ENCRYPTION_MASTER_KEY_B64 and ENCRYPTION_INDEX_KEY_B64 environment variables'
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Workspace encryption is properly configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate encryption config for actual profile saves
    const encryptionCheck = validateEncryptionConfig();
    if (!encryptionCheck.valid) {
      console.error('Encryption config invalid:', encryptionCheck.error);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error', 
          message: encryptionCheck.error,
          adminAction: 'Configure ENCRYPTION_MASTER_KEY_B64 and ENCRYPTION_INDEX_KEY_B64 environment variables'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
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

    // Use user_id as workspace_id until workspaces are implemented
    const workspaceId = user.id;

    // Prepare data for database update
    const updateData: any = {};

    // Handle non-encrypted fields
    if (body.company_name !== undefined) updateData.company_name = body.company_name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;

    // Handle encrypted fields with fingerprints
    if (body.bank_details !== undefined) {
      if (body.bank_details && body.bank_details.trim()) {
        const encrypted = await encryptField(supabase, workspaceId, body.bank_details);
        updateData.bank_details_enc = encrypted;
        // Generate IBAN fingerprint (normalize IBAN format)
        try {
          const normalizedIban = body.bank_details.replace(/\s/g, '').toUpperCase();
          if (normalizedIban.match(/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/)) {
            const fp = await hmacFingerprint(normalizedIban);
            updateData.iban_fp = Array.from(fp);
          }
        } catch (error) {
          console.error('Failed to generate IBAN fingerprint:', error);
        }
      } else {
        updateData.bank_details_enc = null;
        updateData.iban_fp = null;
      }
      // Clear plaintext field
      updateData.bank_details = null;
    }

    if (body.vat_id !== undefined) {
      if (body.vat_id && body.vat_id.trim()) {
        const encrypted = await encryptField(supabase, workspaceId, body.vat_id);
        updateData.vat_id_enc = encrypted;
        // Generate VAT ID fingerprint
        try {
          const fp = await hmacFingerprint(body.vat_id);
          updateData.vat_fp = Array.from(fp);
        } catch (error) {
          console.error('Failed to generate VAT fingerprint:', error);
        }
      } else {
        updateData.vat_id_enc = null;
        updateData.vat_fp = null;
      }
      // Clear plaintext field
      updateData.vat_id = null;
    }

    // Update profile in database
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to save profile', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the operation for audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'profile_encrypted_update',
      details: {
        fields_updated: Object.keys(updateData),
        has_encrypted_data: !!(body.bank_details || body.vat_id),
        workspace_id: workspaceId,
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Profile saved successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Encryption error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Encryption failed', 
        message: error.message,
        adminAction: 'Check ENCRYPTION_MASTER_KEY_B64 and ENCRYPTION_INDEX_KEY_B64 configuration'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});