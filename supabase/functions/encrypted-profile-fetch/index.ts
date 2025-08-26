import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { 
  validateEncryptionConfig, 
  getWorkspaceDEK, 
  decryptField, 
  DecryptionError 
} from '../workspace-crypto/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate encryption configuration
    const config = validateEncryptionConfig();
    if (!config.valid) {
      console.error('Encryption configuration error:', config.error);
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

    // Get profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profile', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use user_id as workspace_id until workspaces are implemented
    const workspaceId = user.id;
    
    // Decrypt sensitive fields if they exist and are encrypted
    let bank_details = null;
    let vat_id = null;
    let company_name = profile.company_name;
    let address = profile.address;
    let encryptionErrors: string[] = [];
    
    try {
      // Handle bank_details (both old and new formats)
      if (profile.bank_details_enc) {
        try {
          if (typeof profile.bank_details_enc === 'object' && profile.bank_details_enc.iv && profile.bank_details_enc.ct) {
            // Old format - need to convert to new workspace format
            // For now, just return null and mark as needing re-encryption
            bank_details = null;
            encryptionErrors.push('bank_details');
          } else if (typeof profile.bank_details_enc === 'string') {
            bank_details = await decryptField(supabase, workspaceId, profile.bank_details_enc);
          }
        } catch (error) {
          console.error('Failed to decrypt bank_details:', error.message);
          encryptionErrors.push('bank_details');
        }
      } else if (profile.bank_details && !profile.bank_details.startsWith('enc:')) {
        // Fallback to plain text field
        bank_details = profile.bank_details;
      }
      
      // Handle vat_id (both old and new formats)
      if (profile.vat_id_enc) {
        try {
          if (typeof profile.vat_id_enc === 'object' && profile.vat_id_enc.iv && profile.vat_id_enc.ct) {
            // Old format - need to convert to new workspace format
            // For now, just return null and mark as needing re-encryption
            vat_id = null;
            encryptionErrors.push('vat_id');
          } else if (typeof profile.vat_id_enc === 'string') {
            vat_id = await decryptField(supabase, workspaceId, profile.vat_id_enc);
          }
        } catch (error) {
          console.error('Failed to decrypt vat_id:', error.message);
          encryptionErrors.push('vat_id');
        }
      } else if (profile.vat_id && !profile.vat_id.startsWith('enc:')) {
        // Fallback to plain text field
        vat_id = profile.vat_id;
      }
      
    } catch (error) {
      console.error('Decryption error:', error.message);
    }

    // Return profile with decrypted sensitive fields
    // Remove encrypted fields from response
    const { bank_details_enc, vat_id_enc, ...cleanProfile } = profile;
    
    const responseProfile = {
      ...cleanProfile,
      bank_details,
      vat_id,
      company_name,
      address,
      // Include encryption status for UI
      encryption_status: {
        enabled: true,
        errors: encryptionErrors.length > 0 ? encryptionErrors : undefined
      }
    };

    // Log the access for audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'profile_encrypted_access',
      details: {
        has_encrypted_bank_details: !!profile.bank_details_enc,
        has_encrypted_vat_id: !!profile.vat_id_enc,
        encryption_errors: encryptionErrors,
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });

    return new Response(
      JSON.stringify({ profile: responseProfile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Profile fetch error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to fetch profile', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});