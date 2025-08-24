/**
 * Encryption utilities interface for TypeScript
 * This file defines types and interfaces for encryption functions
 * Actual implementation should be done in edge functions using Deno
 */

export interface EncryptedPayload {
  iv: string;
  ct: string;
}

export interface EncryptionConfig {
  valid: boolean;
  error?: string;
}

// Type definitions for edge function use
export type EncryptStringFunction = (
  plaintext: string, 
  keyVersion?: 'current' | 'prev'
) => Promise<EncryptedPayload>;

export type DecryptStringFunction = (
  payload: EncryptedPayload,
  keyVersion?: 'current' | 'prev'  
) => Promise<string>;

export type ValidateEncryptionConfigFunction = () => EncryptionConfig;

// These functions are implemented in edge functions where Deno is available
export const encryptString: EncryptStringFunction = async () => {
  throw new Error('encryptString can only be used in Supabase edge functions');
};

export const decryptString: DecryptStringFunction = async () => {
  throw new Error('decryptString can only be used in Supabase edge functions');
};

export const validateEncryptionConfig: ValidateEncryptionConfigFunction = () => {
  throw new Error('validateEncryptionConfig can only be used in Supabase edge functions');
};