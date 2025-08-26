/**
 * Workspace-scoped encryption utilities for Supabase Edge Functions
 * Provides DEK management and field encryption/decryption
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
 * Generate workspace DEK and store it
 */
async function generateWorkspaceDEK(supabase: any, workspaceId: string): Promise<Uint8Array> {
  // Generate new 32-byte DEK
  const dek = crypto.getRandomValues(new Uint8Array(32));
  
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
  const { error } = await supabase
    .from('workspace_keys')
    .upsert({
      workspace_id: workspaceId,
      dek_cipher: Array.from(cipher),
      dek_nonce: Array.from(nonce),
      dek_tag: Array.from(tag),
      version: 1
    });
    
  if (error) {
    throw new Error(`Failed to store workspace key: ${error.message}`);
  }
  
  return dek;
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
    dek = await generateWorkspaceDEK(supabase, workspaceId);
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

/**
 * Generate HMAC fingerprint for exact search
 */
export function hmacFingerprint(value: string): Uint8Array {
  if (!value || typeof value !== 'string') {
    throw new Error('Value must be a non-empty string');
  }
  
  const indexKey = getIndexKey();
  const encoder = new TextEncoder();
  
  // Normalize: trim whitespace and lowercase
  const normalized = value.trim().toLowerCase();
  const data = encoder.encode(normalized);
  
  // HMAC-SHA256 using Web Crypto API
  return crypto.subtle.importKey(
    'raw',
    indexKey,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(key => 
    crypto.subtle.sign('HMAC', key, data)
  ).then(signature => 
    new Uint8Array(signature)
  );
}