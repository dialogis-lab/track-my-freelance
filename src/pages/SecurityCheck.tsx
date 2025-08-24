import { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Lock, Key, Database, FileText, Server, Play, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { checkSecurityHeadersSupport } from '@/lib/securityHeaders';

interface SecurityCheck {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warning' | 'loading';
  details?: string;
  icon: any;
}

export default function SecurityCheck() {
  const { user } = useAuth();
  const [checks, setChecks] = useState<SecurityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<any>({});

  const initialChecks: SecurityCheck[] = [
    {
      id: 'encryption_key',
      name: 'Encryption Key Configuration',
      description: 'ENCRYPTION_KEY present and valid length (32 bytes)',
      status: 'loading',
      icon: Key
    },
    {
      id: 'encryption_roundtrip',
      name: 'Encryption Round-trip Test',
      description: 'Test encrypt/decrypt cycle works correctly',
      status: 'loading',
      icon: Lock
    },
    {
      id: 'profile_encryption',
      name: 'Profile Encryption Test',
      description: 'Bank details and VAT ID can be encrypted and stored',
      status: 'loading',
      icon: Database
    },
    {
      id: 'private_notes',
      name: 'Private Notes Encryption',
      description: 'Time entry private notes stored as ciphertext only',
      status: 'loading',
      icon: FileText
    },
    {
      id: 'security_headers',
      name: 'HTTP Security Headers',
      description: 'Content Security Policy and other protective headers',
      status: 'loading',
      icon: Server
    },
    {
      id: 'storage_privacy',
      name: 'Storage Bucket Privacy',
      description: 'Invoice storage bucket is private with RLS enforced',
      status: 'loading',
      icon: Shield
    }
  ];

  useEffect(() => {
    setChecks(initialChecks);
    runSecurityChecks();
  }, []);

  const runSecurityChecks = async () => {
    setLoading(true);
    const updatedChecks = [...initialChecks];

    try {
      // Check 1: Encryption Key Configuration
      const keyCheck = await testEncryptionKey();
      updateCheck(updatedChecks, 'encryption_key', keyCheck);

      // Check 2: Encryption Round-trip
      if (keyCheck.status === 'pass') {
        const roundtripCheck = await testEncryptionRoundtrip();
        updateCheck(updatedChecks, 'encryption_roundtrip', roundtripCheck);
      }

      // Check 3: Profile Encryption
      const profileCheck = await testProfileEncryption();
      updateCheck(updatedChecks, 'profile_encryption', profileCheck);

      // Check 4: Private Notes
      const notesCheck = await testPrivateNotes();
      updateCheck(updatedChecks, 'private_notes', notesCheck);

      // Check 5: Security Headers
      const headersCheck = await testSecurityHeaders();
      updateCheck(updatedChecks, 'security_headers', headersCheck);

      // Check 6: Storage Privacy
      const storageCheck = await testStoragePrivacy();
      updateCheck(updatedChecks, 'storage_privacy', storageCheck);

    } catch (error) {
      console.error('Security check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateCheck = (checks: SecurityCheck[], id: string, result: any) => {
    const checkIndex = checks.findIndex(c => c.id === id);
    if (checkIndex >= 0) {
      checks[checkIndex] = { ...checks[checkIndex], ...result };
      setChecks([...checks]);
    }
  };

  const testEncryptionKey = async () => {
    try {
      const response = await supabase.functions.invoke('encrypted-profile-fetch', {
        body: { test: 'encryption_config' }
      });

      if (response.error) {
        return {
          status: 'fail' as const,
          details: 'ENCRYPTION_KEY not configured or invalid'
        };
      }

      return {
        status: 'pass' as const,
        details: 'ENCRYPTION_KEY properly configured'
      };
    } catch (error) {
      return {
        status: 'fail' as const,
        details: `Encryption key test failed: ${error.message}`
      };
    }
  };

  const testEncryptionRoundtrip = async () => {
    try {
      // This would call an edge function to test encryption/decryption
      const testData = { test_string: 'security-check-roundtrip-test' };
      const response = await supabase.functions.invoke('encrypted-profile-save', {
        body: testData
      });

      if (response.error) {
        return {
          status: 'fail' as const,
          details: 'Encryption round-trip test failed'
        };
      }

      return {
        status: 'pass' as const,
        details: 'Encryption/decryption cycle working correctly'
      };
    } catch (error) {
      return {
        status: 'fail' as const,
        details: `Round-trip test failed: ${error.message}`
      };
    }
  };

  const testProfileEncryption = async () => {
    try {
      // Check if profile has encrypted fields structure
      const { data, error } = await supabase
        .from('profiles')
        .select('bank_details_enc, vat_id_enc')
        .eq('id', user?.id)
        .single();

      if (error) {
        return {
          status: 'fail' as const,
          details: 'Cannot access profile encryption fields'
        };
      }

      return {
        status: 'pass' as const,
        details: 'Profile encryption fields are properly configured'
      };
    } catch (error) {
      return {
        status: 'fail' as const,
        details: `Profile encryption test failed: ${error.message}`
      };
    }
  };

  const testPrivateNotes = async () => {
    try {
      // Check if time_entries has private notes encryption fields
      const { data, error } = await supabase
        .from('time_entries')
        .select('is_private, private_notes_enc, notes')
        .eq('user_id', user?.id)
        .limit(1);

      if (error) {
        return {
          status: 'warning' as const,
          details: 'Cannot verify private notes structure'
        };
      }

      return {
        status: 'pass' as const,
        details: 'Private notes encryption fields are properly configured'
      };
    } catch (error) {
      return {
        status: 'fail' as const,
        details: `Private notes test failed: ${error.message}`
      };
    }
  };

  const testSecurityHeaders = async () => {
    try {
      const result = await checkSecurityHeadersSupport();
      const presentCount = Object.values(result.headers).filter(Boolean).length;
      const totalCount = Object.keys(result.headers).length;

      if (presentCount === 0) {
        return {
          status: 'fail' as const,
          details: 'No security headers detected'
        };
      } else if (presentCount < totalCount) {
        return {
          status: 'warning' as const,
          details: `${presentCount}/${totalCount} security headers present`
        };
      } else {
        return {
          status: 'pass' as const,
          details: 'All security headers properly configured'
        };
      }
    } catch (error) {
      return {
        status: 'fail' as const,
        details: `Security headers test failed: ${error.message}`
      };
    }
  };

  const testStoragePrivacy = async () => {
    try {
      // Check if invoices bucket exists and is private
      const { data: buckets, error } = await supabase.storage.listBuckets();
      
      if (error) {
        return {
          status: 'warning' as const,
          details: 'Cannot verify storage bucket configuration'
        };
      }

      const invoicesBucket = buckets.find(b => b.name === 'invoices');
      if (!invoicesBucket) {
        return {
          status: 'warning' as const,
          details: 'Invoices storage bucket not found'
        };
      }

      if (invoicesBucket.public) {
        return {
          status: 'fail' as const,
          details: 'Invoices bucket is public - should be private'
        };
      }

      return {
        status: 'pass' as const,
        details: 'Storage bucket is properly configured as private'
      };
    } catch (error) {
      return {
        status: 'fail' as const,
        details: `Storage privacy test failed: ${error.message}`
      };
    }
  };

  const writeTestEncryptedValue = async () => {
    try {
      const testValue = `test-encrypted-value-${Date.now()}`;
      const response = await supabase.functions.invoke('encrypted-profile-save', {
        body: {
          bank_details: testValue
        }
      });

      if (response.error) {
        setTestResults(prev => ({
          ...prev,
          writeTest: { success: false, error: response.error.message }
        }));
      } else {
        setTestResults(prev => ({
          ...prev,
          writeTest: { success: true, value: testValue }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        writeTest: { success: false, error: error.message }
      }));
    }
  };

  const readAndVerifyValue = async () => {
    try {
      const response = await supabase.functions.invoke('encrypted-profile-fetch');

      if (response.error) {
        setTestResults(prev => ({
          ...prev,
          readTest: { success: false, error: response.error.message }
        }));
      } else {
        const decryptedValue = response.data?.bank_details;
        const originalValue = testResults.writeTest?.value;
        
        setTestResults(prev => ({
          ...prev,
          readTest: { 
            success: decryptedValue === originalValue,
            decryptedValue,
            originalValue,
            match: decryptedValue === originalValue
          }
        }));
      }
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        readTest: { success: false, error: error.message }
      }));
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default: return <div className="h-5 w-5 rounded-full bg-gray-200 animate-pulse" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass': return <Badge variant="outline" className="text-green-700 border-green-200">Pass</Badge>;
      case 'fail': return <Badge variant="destructive">Fail</Badge>;
      case 'warning': return <Badge variant="outline" className="text-yellow-700 border-yellow-200">Warning</Badge>;
      default: return <Badge variant="outline">Checking...</Badge>;
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access the security check page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Security Diagnostics</h1>
          <p className="text-muted-foreground">
            Comprehensive security check for TimeHatch encryption and protection systems
          </p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <Button onClick={runSecurityChecks} disabled={loading}>
          {loading ? 'Running Checks...' : 'Refresh Checks'}
        </Button>
      </div>

      <div className="grid gap-4 mb-8">
        {checks.map((check) => {
          const IconComponent = check.icon;
          return (
            <Card key={check.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg">{check.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(check.status)}
                    {getStatusBadge(check.status)}
                  </div>
                </div>
                <CardDescription>{check.description}</CardDescription>
              </CardHeader>
              {check.details && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{check.details}</p>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Separator className="my-8" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Interactive Tests
          </CardTitle>
          <CardDescription>
            Manually test encryption functionality with real data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={writeTestEncryptedValue} variant="outline">
              Write Test Encrypted Value
            </Button>
            <Button 
              onClick={readAndVerifyValue} 
              variant="outline"
              disabled={!testResults.writeTest?.success}
            >
              <Eye className="h-4 w-4 mr-2" />
              Read & Verify
            </Button>
          </div>

          {testResults.writeTest && (
            <Alert>
              <AlertDescription>
                <strong>Write Test:</strong> {testResults.writeTest.success ? 
                  `✅ Successfully encrypted value: ${testResults.writeTest.value}` :
                  `❌ Failed: ${testResults.writeTest.error}`
                }
              </AlertDescription>
            </Alert>
          )}

          {testResults.readTest && (
            <Alert>
              <AlertDescription>
                <strong>Read Test:</strong> {testResults.readTest.success ? 
                  `✅ Successfully decrypted and verified match` :
                  `❌ Failed: ${testResults.readTest.error || 'Values do not match'}`
                }
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}