import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Import crypto utilities - these files are copied during edge function deployment
async function validateEncryptionConfig(): Promise<{ isValid: boolean; error?: string }> {
  const key = Deno.env.get('ENCRYPTION_KEY');
  
  if (!key) {
    return {
      isValid: false,
      error: 'ENCRYPTION_KEY not configured. Admin must set a 32-byte base64 encryption key.'
    };
  }

  try {
    const keyBuffer = new Uint8Array(atob(key).split('').map(c => c.charCodeAt(0)));
    if (keyBuffer.length !== 32) {
      return {
        isValid: false,
        error: `ENCRYPTION_KEY must be 32 bytes, got ${keyBuffer.length} bytes.`
      };
    }
  } catch {
    return {
      isValid: false,
      error: 'ENCRYPTION_KEY is not valid base64.'
    };
  }

  return { isValid: true };
}

async function encryptString(plaintext: string): Promise<{ iv: string; ct: string }> {
  if (!plaintext) {
    throw new Error('Cannot encrypt empty plaintext');
  }

  const keyB64 = Deno.env.get('ENCRYPTION_KEY');
  if (!keyB64) {
    throw new Error('Missing ENCRYPTION_KEY environment variable');
  }

  const keyBuffer = new Uint8Array(atob(keyB64).split('').map(c => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  
  // Generate random 12-byte IV for GCM
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the plaintext
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );

  // Return base64 encoded IV and ciphertext
  return {
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  };
}

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
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body first to check if this is a test request
    const body: ProfileSaveRequest & { test_encryption?: string } = await req.json();

    // Handle health check test requests
    if (body.test_encryption === 'health_check') {
      const encryptionCheck = validateEncryptionConfig();
      if (!encryptionCheck.isValid) {
        return new Response(
          JSON.stringify({ 
            error: 'Server configuration error', 
            message: encryptionCheck.error,
            adminAction: 'Configure ENCRYPTION_KEY environment variable'
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      return new Response(
        JSON.stringify({ success: true, message: 'Encryption is properly configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate encryption config for actual profile saves
    const encryptionCheck = validateEncryptionConfig();
    if (!encryptionCheck.isValid) {
      console.error('Encryption config invalid:', encryptionCheck.error);
      return new Response(
        JSON.stringify({ 
          error: 'Server configuration error', 
          message: encryptionCheck.error,
          adminAction: 'Configure ENCRYPTION_KEY environment variable'
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

    // Parse request body
    const profileBody: ProfileSaveRequest = body;

    // Prepare data for database update
    const updateData: any = {};

    // Handle non-encrypted fields
    if (body.company_name !== undefined) updateData.company_name = body.company_name;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;

    // Handle encrypted fields
    if (body.bank_details !== undefined) {
      if (body.bank_details.trim()) {
        const encrypted = await encryptString(body.bank_details);
        updateData.bank_details_enc = encrypted;
      } else {
        updateData.bank_details_enc = null;
      }
      // Clear plaintext field
      updateData.bank_details = null;
    }

    if (body.vat_id !== undefined) {
      if (body.vat_id.trim()) {
        const encrypted = await encryptString(body.vat_id);
        updateData.vat_id_enc = encrypted;
      } else {
        updateData.vat_id_enc = null;
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
        adminAction: 'Check ENCRYPTION_KEY configuration'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});