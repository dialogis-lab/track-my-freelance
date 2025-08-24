import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Import crypto utilities - inline implementation for edge functions
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

interface TimeEntrySaveRequest {
  id?: string;
  project_id: string;
  started_at: string;
  stopped_at?: string;
  notes?: string;
  is_private?: boolean;
  private_notes?: string;
  minutes_manual?: number;
  tags?: string[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate encryption configuration for private notes
    const body: TimeEntrySaveRequest = await req.json();
    
    if (body.is_private && body.private_notes) {
      const encryptionCheck = validateEncryptionConfig();
      if (!encryptionCheck.isValid) {
        console.error('Encryption config invalid:', encryptionCheck.error);
        return new Response(
          JSON.stringify({ 
            error: 'Server configuration error', 
            message: 'Cannot save private notes: ' + encryptionCheck.error,
            adminAction: 'Configure ENCRYPTION_KEY environment variable'
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
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

    // Prepare data for database operation
    const entryData: any = {
      user_id: user.id,
      project_id: body.project_id,
      started_at: body.started_at,
      stopped_at: body.stopped_at,
      is_private: body.is_private || false,
      minutes_manual: body.minutes_manual,
      tags: body.tags
    };

    // Handle notes based on privacy setting
    if (body.is_private && body.private_notes) {
      // Encrypt private notes
      const encrypted = await encryptString(body.private_notes);
      entryData.private_notes_enc = encrypted;
      entryData.notes = null; // Clear regular notes
    } else {
      // Store regular notes
      entryData.notes = body.notes;
      entryData.private_notes_enc = null; // Clear encrypted notes
    }

    let result;
    if (body.id) {
      // Update existing entry
      const { data, error } = await supabase
        .from('time_entries')
        .update(entryData)
        .eq('id', body.id)
        .eq('user_id', user.id) // Ensure user owns the entry
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new entry
      const { data, error } = await supabase
        .from('time_entries')
        .insert(entryData)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }

    // Log the operation for audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      event_type: body.id ? 'time_entry_encrypted_update' : 'time_entry_encrypted_create',
      details: {
        entry_id: result.id,
        is_private: body.is_private,
        has_encrypted_notes: !!(body.is_private && body.private_notes),
        timestamp: new Date().toISOString()
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip'),
      user_agent: req.headers.get('user-agent')
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: body.id ? 'Time entry updated successfully' : 'Time entry created successfully',
        entry: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Time entry save error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to save time entry', 
        message: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});