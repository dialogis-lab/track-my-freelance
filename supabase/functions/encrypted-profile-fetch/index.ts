import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Import crypto utilities - these functions are defined inline for edge functions
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

async function decryptString(payload: { iv: string; ct: string }): Promise<string> {
  if (!payload.iv || !payload.ct) {
    throw new Error('Invalid encrypted payload: missing iv or ct');
  }

  // Try current key first, then previous key for rotation support
  const keys = [
    { version: 'current', envVar: 'ENCRYPTION_KEY' },
    { version: 'prev', envVar: 'ENCRYPTION_KEY_PREV' }
  ];
  
  for (const keyConfig of keys) {
    try {
      const keyB64 = Deno.env.get(keyConfig.envVar);
      if (!keyB64 && keyConfig.version === 'prev') continue; // Previous key is optional
      if (!keyB64) throw new Error(`Missing ${keyConfig.envVar}`);
      
      const keyBuffer = new Uint8Array(atob(keyB64).split('').map(c => c.charCodeAt(0)));
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
      
      // Decode base64 IV and ciphertext
      const iv = new Uint8Array(atob(payload.iv).split('').map(c => c.charCodeAt(0)));
      const ciphertext = new Uint8Array(atob(payload.ct).split('').map(c => c.charCodeAt(0)));
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      // If it's the last key to try, throw the error
      if (keyConfig.version === 'prev') {
        throw new Error(`Decryption failed with all available keys: ${error.message}`);
      }
      // Otherwise, try the next key
      continue;
    }
  }
  
  throw new Error('Decryption failed: no valid keys found');
}

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

    // Decrypt sensitive fields
    const decryptedProfile = { ...profile };

    try {
      if (profile.bank_details_enc) {
        decryptedProfile.bank_details = await decryptString(profile.bank_details_enc);
      }
    } catch (error) {
      console.error('Failed to decrypt bank_details:', error);
      decryptedProfile.bank_details = '[DECRYPTION_ERROR]';
    }

    try {
      if (profile.vat_id_enc) {
        decryptedProfile.vat_id = await decryptString(profile.vat_id_enc);
      }
    } catch (error) {
      console.error('Failed to decrypt vat_id:', error);
      decryptedProfile.vat_id = '[DECRYPTION_ERROR]';
    }

    // Remove encrypted fields from response (never send ciphertext to client)
    delete decryptedProfile.bank_details_enc;
    delete decryptedProfile.vat_id_enc;

    // Log the access for audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: 'profile_encrypted_access',
      details: {
        has_encrypted_bank_details: !!profile.bank_details_enc,
        has_encrypted_vat_id: !!profile.vat_id_enc,
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });

    return new Response(
      JSON.stringify({ profile: decryptedProfile }),
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