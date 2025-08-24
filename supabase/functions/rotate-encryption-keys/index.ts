import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Crypto utilities inline
async function encryptString(plaintext: string, keyVersion = 'current'): Promise<{ iv: string; ct: string }> {
  const envKey = keyVersion === 'current' ? 'ENCRYPTION_KEY' : 'ENCRYPTION_KEY_PREV';
  const keyB64 = Deno.env.get(envKey);
  
  if (!keyB64) {
    throw new Error(`Missing ${envKey} environment variable`);
  }

  const keyBuffer = new Uint8Array(atob(keyB64).split('').map(c => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedText = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText
  );

  return {
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  };
}

async function decryptString(payload: { iv: string; ct: string }, keyVersion = 'prev'): Promise<string> {
  const envKey = keyVersion === 'current' ? 'ENCRYPTION_KEY' : 'ENCRYPTION_KEY_PREV';
  const keyB64 = Deno.env.get(envKey);
  
  if (!keyB64) {
    throw new Error(`Missing ${envKey} environment variable`);
  }

  const keyBuffer = new Uint8Array(atob(keyB64).split('').map(c => c.charCodeAt(0)));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
  
  const iv = new Uint8Array(atob(payload.iv).split('').map(c => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(payload.ct).split('').map(c => c.charCodeAt(0)));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return new TextDecoder().decode(decrypted);
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // This should only be called by administrators
    // In production, add proper admin authentication here
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check that both keys are available
    const currentKey = Deno.env.get('ENCRYPTION_KEY');
    const prevKey = Deno.env.get('ENCRYPTION_KEY_PREV');
    
    if (!currentKey || !prevKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Key rotation requires both ENCRYPTION_KEY and ENCRYPTION_KEY_PREV to be set' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processedProfiles = 0;
    let processedTimeEntries = 0;
    const errors: string[] = [];

    // Rotate profile encryption keys
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, bank_details_enc, vat_id_enc')
      .not('bank_details_enc', 'is', null)
      .or('vat_id_enc.not.is.null');

    if (profilesError) {
      errors.push(`Failed to fetch profiles: ${profilesError.message}`);
    } else {
      for (const profile of profiles || []) {
        try {
          const updates: any = {};
          
          // Re-encrypt bank_details_enc with new key
          if (profile.bank_details_enc) {
            const decrypted = await decryptString(profile.bank_details_enc, 'prev');
            const reencrypted = await encryptString(decrypted, 'current');
            updates.bank_details_enc = reencrypted;
          }
          
          // Re-encrypt vat_id_enc with new key
          if (profile.vat_id_enc) {
            const decrypted = await decryptString(profile.vat_id_enc, 'prev');
            const reencrypted = await encryptString(decrypted, 'current');
            updates.vat_id_enc = reencrypted;
          }
          
          if (Object.keys(updates).length > 0) {
            const { error } = await supabase
              .from('profiles')
              .update(updates)
              .eq('id', profile.id);
            
            if (error) {
              errors.push(`Failed to update profile ${profile.id}: ${error.message}`);
            } else {
              processedProfiles++;
            }
          }
        } catch (error) {
          errors.push(`Failed to process profile ${profile.id}: ${error.message}`);
        }
      }
    }

    // Rotate time entries encryption keys
    const { data: timeEntries, error: timeEntriesError } = await supabase
      .from('time_entries')
      .select('id, private_notes_enc')
      .not('private_notes_enc', 'is', null);

    if (timeEntriesError) {
      errors.push(`Failed to fetch time entries: ${timeEntriesError.message}`);
    } else {
      for (const entry of timeEntries || []) {
        try {
          if (entry.private_notes_enc) {
            const decrypted = await decryptString(entry.private_notes_enc, 'prev');
            const reencrypted = await encryptString(decrypted, 'current');
            
            const { error } = await supabase
              .from('time_entries')
              .update({ private_notes_enc: reencrypted })
              .eq('id', entry.id);
            
            if (error) {
              errors.push(`Failed to update time entry ${entry.id}: ${error.message}`);
            } else {
              processedTimeEntries++;
            }
          }
        } catch (error) {
          errors.push(`Failed to process time entry ${entry.id}: ${error.message}`);
        }
      }
    }

    // Log the rotation operation
    await supabase.from('audit_logs').insert({
      user_id: null, // System operation
      event_type: 'encryption_key_rotation',
      details: {
        processed_profiles: processedProfiles,
        processed_time_entries: processedTimeEntries,
        errors: errors.length,
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Key rotation completed',
        summary: {
          processed_profiles: processedProfiles,
          processed_time_entries: processedTimeEntries,
          errors: errors.length
        },
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Key rotation error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Key rotation failed', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});