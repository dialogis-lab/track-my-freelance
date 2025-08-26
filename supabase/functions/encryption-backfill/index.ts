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