/**
 * Workspace-scoped encryption utilities for sensitive fields
 * Uses AES-256-GCM with HMAC fingerprints for exact search
 */

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
 * Get master encryption key from environment
 */
export function getMasterKey(): Uint8Array {
  const keyB64 = process.env.ENCRYPTION_MASTER_KEY_B64;
  if (!keyB64) {
    throw new Error('ENCRYPTION_MASTER_KEY_B64 environment variable not set');
  }
  
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY_B64 must be exactly 32 bytes when decoded');
  }
  
  return new Uint8Array(key);
}

/**
 * Get index key for HMAC fingerprints
 */
export function getIndexKey(): Uint8Array {
  const keyB64 = process.env.ENCRYPTION_INDEX_KEY_B64;
  if (!keyB64) {
    throw new Error('ENCRYPTION_INDEX_KEY_B64 environment variable not set');
  }
  
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_INDEX_KEY_B64 must be exactly 32 bytes when decoded');
  }
  
  return new Uint8Array(key);
}

/**
 * AES-GCM encrypt with optional associated data
 */
export function aesGcmEncrypt(key: Uint8Array, plaintext: Buffer, aad?: Buffer): EncryptedToken {
  const crypto = require('crypto');
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipherGCM('aes-256-gcm');
  
  cipher.setAAD(aad || Buffer.alloc(0));
  cipher.init(key, iv);
  
  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  return {
    version: 'v1',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    tag: tag.toString('base64')
  };
}

/**
 * AES-GCM decrypt with optional associated data
 */
export function aesGcmDecrypt(key: Uint8Array, token: EncryptedToken, aad?: Buffer): Buffer {
  const crypto = require('crypto');
  const decipher = crypto.createDecipherGCM('aes-256-gcm');
  
  const iv = Buffer.from(token.iv, 'base64');
  const ciphertext = Buffer.from(token.ciphertext, 'base64');
  const tag = Buffer.from(token.tag, 'base64');
  
  decipher.setAAD(aad || Buffer.alloc(0));
  decipher.setAuthTag(tag);
  decipher.init(key, iv);
  
  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
  } catch (error) {
    throw new DecryptionError('Failed to decrypt data: invalid key or corrupted data');
  }
}

/**
 * Wrap DEK with master key
 */
export function wrapDEK(masterKey: Uint8Array, dek: Uint8Array): { cipher: Buffer; nonce: Buffer; tag: Buffer } {
  const crypto = require('crypto');
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipherGCM('aes-256-gcm');
  
  cipher.init(masterKey, nonce);
  const encrypted = Buffer.concat([
    cipher.update(dek),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  
  return {
    cipher: encrypted,
    nonce: nonce,
    tag: tag
  };
}

/**
 * Unwrap DEK with master key
 */
export function unwrapDEK(masterKey: Uint8Array, parts: { cipher: Buffer; nonce: Buffer; tag: Buffer }): Uint8Array {
  const crypto = require('crypto');
  const decipher = crypto.createDecipherGCM('aes-256-gcm');
  
  decipher.setAuthTag(parts.tag);
  decipher.init(masterKey, parts.nonce);
  
  try {
    const decrypted = Buffer.concat([
      decipher.update(parts.cipher),
      decipher.final()
    ]);
    return new Uint8Array(decrypted);
  } catch (error) {
    throw new DecryptionError('Failed to unwrap DEK: invalid master key');
  }
}

/**
 * Generate normalized HMAC fingerprint for exact search
 */
export function hmacFingerprint(value: string): Buffer {
  if (!value || typeof value !== 'string') {
    throw new Error('Value must be a non-empty string');
  }
  
  const crypto = require('crypto');
  const indexKey = getIndexKey();
  
  // Normalize: trim whitespace and lowercase for emails/identifiers
  const normalized = value.trim().toLowerCase();
  
  return crypto
    .createHmac('sha256', indexKey)
    .update(normalized, 'utf8')
    .digest();
}

/**
 * Parse encrypted token from string format
 */
export function parseEncryptedToken(tokenString: string): EncryptedToken | null {
  if (!tokenString || !tokenString.startsWith('enc:')) {
    return null;
  }
  
  const parts = tokenString.split(':');
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    return null;
  }
  
  return {
    version: parts[1],
    iv: parts[2],
    ciphertext: parts[3],
    tag: parts[4]
  };
}

/**
 * Format encrypted token to string
 */
export function formatEncryptedToken(token: EncryptedToken): string {
  return `enc:${token.version}:${token.iv}:${token.ciphertext}:${token.tag}`;
}