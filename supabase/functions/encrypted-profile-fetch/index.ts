import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Inline crypto utilities
export interface EncryptedToken {
  version: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface WorkspaceDEK {
  dek: Uint8Array;
  expiresAt: number;
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

// DEK cache with 10-minute TTL
const dekCache = new Map<string, WorkspaceDEK>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Validate encryption configuration
 */
export function validateEncryptionConfig(): { valid: boolean; error?: string } {
  try {
    const masterKey = Deno.env.get('ENCRYPTION_MASTER_KEY_B64');
    const indexKey = Deno.env.get('ENCRYPTION_INDEX_KEY_B64');
    
    if (!masterKey) {
      return { valid: false, error: 'ENCRYPTION_MASTER_KEY_B64 not set' };
    }
    if (!indexKey) {
      return { valid: false, error: 'ENCRYPTION_INDEX_KEY_B64 not set' };
    }
    
    // Validate key lengths
    const masterKeyBytes = atob(masterKey);
    const indexKeyBytes = atob(indexKey);
    
    if (masterKeyBytes.length !== 32) {
      return { valid: false, error: 'ENCRYPTION_MASTER_KEY_B64 must be 32 bytes' };
    }
    if (indexKeyBytes.length !== 32) {
      return { valid: false, error: 'ENCRYPTION_INDEX_KEY_B64 must be 32 bytes' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Key validation failed: ${error.message}` };
  }
}

/**
 * Get master encryption key
 */
function getMasterKey(): Uint8Array {
  const keyB64 = Deno.env.get('ENCRYPTION_MASTER_KEY_B64');
  if (!keyB64) {
    throw new Error('ENCRYPTION_MASTER_KEY_B64 environment variable not set');
  }
  
  const keyBytes = atob(keyB64);
  if (keyBytes.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY_B64 must be exactly 32 bytes when decoded');
  }
  
  return new Uint8Array([...keyBytes].map(c => c.charCodeAt(0)));
}

/**
 * AES-GCM decrypt
 */
async function aesGcmDecrypt(key: Uint8Array, token: EncryptedToken): Promise<string> {
  try {
    const iv = new Uint8Array([...atob(token.iv)].map(c => c.charCodeAt(0)));
    const ct = new Uint8Array([...atob(token.ciphertext)].map(c => c.charCodeAt(0)));
    const tag = new Uint8Array([...atob(token.tag)].map(c => c.charCodeAt(0)));
    
    // Reconstruct full ciphertext with auth tag
    const fullCiphertext = new Uint8Array(ct.length + tag.length);
    fullCiphertext.set(ct);
    fullCiphertext.set(tag, ct.length);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      fullCiphertext
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new DecryptionError('Failed to decrypt data');
  }
}

/**
 * Get or create workspace DEK
 */
export async function getWorkspaceDEK(supabase: any, workspaceId: string): Promise<Uint8Array> {
  // Check cache first
  const cached = dekCache.get(workspaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.dek;
  }
  
  // Fetch from database
  const { data: keyData, error } = await supabase
    .from('workspace_keys')
    .select('dek_cipher, dek_nonce, dek_tag')
    .eq('workspace_id', workspaceId)
    .single();
    
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch workspace key: ${error.message}`);
  }
  
  let dek: Uint8Array;
  
  if (!keyData) {
    // Generate new DEK
    dek = crypto.getRandomValues(new Uint8Array(32));
    
    // Wrap DEK with master key  
    const masterKey = getMasterKey();
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      masterKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const wrapped = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      cryptoKey,
      dek
    );
    
    const wrappedArray = new Uint8Array(wrapped);
    const cipher = wrappedArray.slice(0, -16);
    const tag = wrappedArray.slice(-16);
    
    // Store wrapped DEK in database
    const { error: storeError } = await supabase
      .from('workspace_keys')
      .upsert({
        workspace_id: workspaceId,
        dek_cipher: Array.from(cipher),
        dek_nonce: Array.from(nonce),
        dek_tag: Array.from(tag),
        version: 1
      });
      
    if (storeError) {
      throw new Error(`Failed to store workspace key: ${storeError.message}`);
    }
  } else {
    // Unwrap existing DEK
    const masterKey = getMasterKey();
    const nonce = new Uint8Array(keyData.dek_nonce);
    const cipher = new Uint8Array(keyData.dek_cipher);
    const tag = new Uint8Array(keyData.dek_tag);
    
    // Reconstruct wrapped DEK
    const wrapped = new Uint8Array(cipher.length + tag.length);
    wrapped.set(cipher);
    wrapped.set(tag, cipher.length);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      masterKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    try {
      const unwrapped = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: nonce },
        cryptoKey,
        wrapped
      );
      dek = new Uint8Array(unwrapped);
    } catch (error) {
      throw new DecryptionError('Failed to unwrap DEK');
    }
  }
  
  // Cache DEK
  dekCache.set(workspaceId, {
    dek,
    expiresAt: Date.now() + CACHE_TTL
  });
  
  return dek;
}

/**
 * Decrypt field value
 */
export async function decryptField(supabase: any, workspaceId: string, value: string): Promise<string> {
  if (!value || value === '') {
    return '';
  }
  
  // Not encrypted?
  if (!value.startsWith('enc:')) {
    return value;
  }
  
  const parts = value.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new DecryptionError('Invalid encrypted token format');
  }
  
  const token: EncryptedToken = {
    version: parts[1],
    iv: parts[2],
    ciphertext: parts[3],
    tag: parts[4]
  };
  
  const dek = await getWorkspaceDEK(supabase, workspaceId);
  return await aesGcmDecrypt(dek, token);
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