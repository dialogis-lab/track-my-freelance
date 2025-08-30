import { supabase } from '@/integrations/supabase/client';

export interface MfaFactor {
  id: string;
  type: string;
  status: 'verified' | 'unverified';
  created_at: string;
}

export interface TotpEnrollment {
  factorId: string;
  qr_code: string;
  secret: string;
  uri: string;
}

// List all MFA factors for the user
export async function listFactors(): Promise<MfaFactor[]> {
  try {
    const { data } = await supabase.auth.mfa.listFactors();
    
    const factors: MfaFactor[] = [];
    
    // Add TOTP factors
    if (data?.totp) {
      factors.push(...data.totp.map(f => ({
        id: f.id,
        type: 'totp',
        status: f.status as 'verified' | 'unverified',
        created_at: f.created_at,
      })));
    }
    
    // Add other factors from 'all' array if not already included
    if (data?.all) {
      const existingIds = new Set(factors.map(f => f.id));
      data.all.forEach(f => {
        if (!existingIds.has(f.id)) {
          factors.push({
            id: f.id,
            type: f.factor_type,
            status: f.status as 'verified' | 'unverified',
            created_at: f.created_at,
          });
        }
      });
    }
    
    return factors;
  } catch (error) {
    console.error('Error listing factors:', error);
    return [];
  }
}

// Enroll a new TOTP factor
export async function enrollTotp(): Promise<TotpEnrollment | null> {
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    });

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('No enrollment data received');
    }

    return {
      factorId: data.id,
      qr_code: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  } catch (error) {
    console.error('Error enrolling TOTP:', error);
    throw error;
  }
}

// Verify TOTP code during enrollment or challenge
export async function verifyTotp(factorId: string, code: string, challengeId?: string): Promise<boolean> {
  try {
    console.debug('[MFA] verifyTotp called with:', { factorId, code: '***', challengeId });
    
    const verifyParams: any = {
      factorId,
      code,
    };
    
    // Only include challengeId if it's provided (for existing factors)
    // During enrollment, challengeId should be undefined
    if (challengeId) {
      verifyParams.challengeId = challengeId;
    }
    
    const { error } = await supabase.auth.mfa.verify(verifyParams);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    throw error;
  }
}

// Create MFA challenge
export async function createChallenge(factorId: string): Promise<string> {
  try {
    const { data, error } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (error) {
      throw error;
    }

    if (!data?.id) {
      throw new Error('No challenge ID received');
    }

    return data.id;
  } catch (error) {
    console.error('Error creating challenge:', error);
    throw error;
  }
}

// Unenroll a factor
export async function unenrollFactor(factorId: string): Promise<void> {
  try {
    const { error } = await supabase.auth.mfa.unenroll({
      factorId,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error unenrolling factor:', error);
    throw error;
  }
}

// Generate recovery codes
export async function generateRecoveryCodes(): Promise<string[]> {
  try {
    // Generate recovery codes via edge function since Supabase client doesn't have this method
    const { data: sessionData } = await supabase.auth.getSession();
    
    const response = await supabase.functions.invoke('generate-recovery-codes', {
      headers: {
        'Authorization': `Bearer ${sessionData.session?.access_token}`,
      },
    });

    if (response.error) {
      throw response.error;
    }

    return response.data?.codes || [];
  } catch (error) {
    console.error('Error generating recovery codes:', error);
    throw error;
  }
}

// Download recovery codes as text file
export function downloadRecoveryCodes(codes: string[], filename = 'timehatch-recovery-codes.txt'): void {
  const content = [
    'TimeHatch Recovery Codes',
    '========================',
    '',
    'Keep these codes safe and offline. Each code can only be used once.',
    'If you lose access to your authenticator app, you can use these codes to regain access.',
    '',
    'Generated on: ' + new Date().toLocaleString(),
    '',
    ...codes.map((code, index) => `${index + 1}. ${code}`),
    '',
    'Store these codes in a safe place and never share them with anyone.',
  ].join('\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// Copy recovery codes to clipboard
export async function copyRecoveryCodes(codes: string[]): Promise<void> {
  const content = codes.join('\n');
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(content);
  } else {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// Print recovery codes
export function printRecoveryCodes(codes: string[]): void {
  const content = [
    '<h1>TimeHatch Recovery Codes</h1>',
    '<p><strong>Keep these codes safe and offline. Each code can only be used once.</strong></p>',
    '<p>Generated on: ' + new Date().toLocaleString() + '</p>',
    '<ol>',
    ...codes.map(code => `<li style="font-family: monospace; font-size: 16px; margin: 8px 0;">${code}</li>`),
    '</ol>',
    '<p><small>Store these codes in a safe place and never share them with anyone.</small></p>',
  ].join('\n');

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>TimeHatch Recovery Codes</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; }
            h1 { color: #333; }
            ol { background: #f5f5f5; padding: 20px; border-radius: 8px; }
            li { margin: 10px 0; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}

// Force re-authentication and refresh session to upgrade AAL
export async function reauthAndRefresh(): Promise<void> {
  try {
    // Get fresh session which should now include MFA factors
    await supabase.auth.getSession();
    
    // Additional refresh to ensure state is updated
    window.location.reload();
  } catch (error) {
    console.error('Error re-authenticating:', error);
    throw error;
  }
}

// Verify recovery code via edge function
export async function verifyRecoveryCode(
  factorId: string, 
  challengeId: string, 
  code: string, 
  rememberDevice = false
): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    
    const response = await supabase.functions.invoke('secure-mfa-verify', {
      body: {
        factorId,
        challengeId,
        code,
        type: 'recovery',
        rememberDevice
      },
      headers: {
        'Authorization': `Bearer ${sessionData.session?.access_token}`,
      },
    });

    if (response.error) {
      throw new Error(response.error.message);
    }
  } catch (error) {
    console.error('Error verifying recovery code:', error);
    throw error;
  }
}

// Add trusted device
export async function addTrustedDevice(): Promise<void> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw new Error('No active session');
    }

    if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
      console.info('[MFA] === ADDING TRUSTED DEVICE ===', {
        userId: sessionData.session.user?.id,
        currentCookies: document.cookie.substring(0, 100) + '...',
        userAgent: navigator.userAgent.substring(0, 50) + '...'
      });
    }

    // Make direct HTTP call to ensure body is sent properly
    const supabaseUrl = 'https://ollbuhgghkporvzmrzau.supabase.co';
    const response = await fetch(`${supabaseUrl}/functions/v1/trusted-device`, {
      method: 'POST',
      credentials: 'include', // Ensure cookies are sent and received
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sbGJ1aGdnaGtwb3J2em1yemF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU5MjU5MjksImV4cCI6MjA3MTUwMTkyOX0.6IRGOQDfUgnZgK6idaFYH_rueGFhY7-KFG5ZwvDfsdw',
        'Cookie': document.cookie,
      },
      body: JSON.stringify({ action: 'add' })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (import.meta.env.NEXT_PUBLIC_DEBUG_AUTH === 'true') {
      // Wait a moment for cookies to be set by browser
      setTimeout(() => {
        const updatedCookies = document.cookie;
        const hasTrustedDeviceCookie = updatedCookies.includes('th_td=');
        console.info('[MFA] === TRUSTED DEVICE ADDED ===', {
          success: data.success,
          device_id: data.device_id?.substring(0, 8) + '...',
          expires_at: data.expires_at,
          cookies_before: document.cookie.includes('th_td='),
          cookies_after: hasTrustedDeviceCookie,
          updated_cookies: updatedCookies.substring(0, 150) + '...'
        });
      }, 100);
    }
    
    console.debug('[MFA] Trusted device added successfully:', data);
  } catch (error) {
    console.error('Error adding trusted device:', error);
    throw error;
  }
}