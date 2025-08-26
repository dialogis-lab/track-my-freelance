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
 * Get index key for HMAC fingerprints  
 */
function getIndexKey(): Uint8Array {
  const keyB64 = Deno.env.get('ENCRYPTION_INDEX_KEY_B64');
  if (!keyB64) {
    throw new Error('ENCRYPTION_INDEX_KEY_B64 environment variable not set');
  }
  
  const keyBytes = atob(keyB64);
  if (keyBytes.length !== 32) {
    throw new Error('ENCRYPTION_INDEX_KEY_B64 must be exactly 32 bytes when decoded');
  }
  
  return new Uint8Array([...keyBytes].map(c => c.charCodeAt(0)));
}

/**
 * AES-GCM encrypt
 */
async function aesGcmEncrypt(key: Uint8Array, plaintext: string): Promise<EncryptedToken> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );
  
  // Split ciphertext and auth tag (last 16 bytes)
  const ciphertextArray = new Uint8Array(ciphertext);
  const ct = ciphertextArray.slice(0, -16);
  const tag = ciphertextArray.slice(-16);
  
  return {
    version: 'v1',
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...ct)),
    tag: btoa(String.fromCharCode(...tag))
  };
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
 * Encrypt field value
 */
export async function encryptField(supabase: any, workspaceId: string, value: string): Promise<string> {
  if (!value || value.trim() === '') {
    return '';
  }
  
  // Already encrypted?
  if (value.startsWith('enc:')) {
    return value;
  }
  
  const dek = await getWorkspaceDEK(supabase, workspaceId);
  const token = await aesGcmEncrypt(dek, value);
  return `enc:${token.version}:${token.iv}:${token.ciphertext}:${token.tag}`;
}

/**
 * Generate HMAC fingerprint for exact search
 */
export async function hmacFingerprint(value: string): Promise<Uint8Array> {
  if (!value || typeof value !== 'string') {
    throw new Error('Value must be a non-empty string');
  }
  
  const indexKey = getIndexKey();
  const encoder = new TextEncoder();
  
  // Normalize: trim whitespace and lowercase
  const normalized = value.trim().toLowerCase();
  const data = encoder.encode(normalized);
  
  // HMAC-SHA256 using Web Crypto API
  const key = await crypto.subtle.importKey(
    'raw',
    indexKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(signature);
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