import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, X, Building2, Lock, AlertTriangle, Shield } from 'lucide-react';

interface Profile {
  id: string;
  company_name: string | null;
  address: string | null;
  vat_id: string | null;
  bank_details: string | null;
  logo_url: string | null;
  encryption_status?: {
    enabled: boolean;
    errors?: string[];
  };
}

export function ProfileForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [encryptionStatus, setEncryptionStatus] = useState<{ enabled: boolean; errors?: string[] } | null>(null);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  // Check for changes whenever profile changes
  useEffect(() => {
    if (profile && originalProfile) {
      const hasProfileChanges = 
        profile.company_name !== originalProfile.company_name ||
        profile.address !== originalProfile.address ||
        profile.vat_id !== originalProfile.vat_id ||
        profile.bank_details !== originalProfile.bank_details ||
        profile.logo_url !== originalProfile.logo_url;
      
      setHasChanges(hasProfileChanges);
    }
  }, [profile, originalProfile]);

  const loadProfile = async () => {
    setEncryptionError(null);
    
    try {
      // Use the encrypted profile fetch endpoint
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('https://ollbuhgghkporvzmrzau.supabase.co/functions/v1/encrypted-profile-fetch', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      
      if (!response.ok) {
        if (result.adminAction) {
          setEncryptionError(result.message);
        }
        throw new Error(result.message || 'Failed to load profile');
      }

      const data = result.profile;
      setProfile(data);
      setOriginalProfile(data);
      
      // Set encryption status from response
      if (data.encryption_status) {
        setEncryptionStatus(data.encryption_status);
      }
      
      if (data.logo_url) {
        // If we have a logo URL, try to create a fresh signed URL
        try {
          const urlParts = data.logo_url.split('/');
          const fileName = urlParts[urlParts.length - 1];
          const filePath = `${user!.id}/${fileName}`;
          
          const { data: signedUrlData, error: urlError } = await supabase.storage
            .from('logos')
            .createSignedUrl(filePath, 60 * 60 * 24 * 365);

          if (!urlError && signedUrlData) {
            setLogoPreview(signedUrlData.signedUrl);
          } else {
            setLogoPreview(data.logo_url);
          }
        } catch {
          setLogoPreview(data.logo_url);
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      
      // Fallback to direct database access for non-encrypted fields only
      try {
        const { data, error: dbError } = await supabase
          .from('profiles')
          .select('id, company_name, address, logo_url')
          .eq('id', user!.id)
          .single();

        if (!dbError && data) {
          const fallbackProfile = {
            ...data,
            vat_id: null,
            bank_details: null,
          };
          setProfile(fallbackProfile);
          setOriginalProfile(fallbackProfile);
          
          if (data.logo_url) {
            try {
              const urlParts = data.logo_url.split('/');
              const fileName = urlParts[urlParts.length - 1];
              const filePath = `${user!.id}/${fileName}`;
              
              const { data: signedUrlData, error: urlError } = await supabase.storage
                .from('logos')
                .createSignedUrl(filePath, 60 * 60 * 24 * 365);

              if (!urlError && signedUrlData) {
                setLogoPreview(signedUrlData.signedUrl);
              }
            } catch {
              // Fallback to original URL
            }
          }
        } else {
          // Create empty profile
          const emptyProfile = {
            id: user!.id,
            company_name: null,
            address: null,
            vat_id: null,
            bank_details: null,
            logo_url: null,
          };
          setProfile(emptyProfile);
          setOriginalProfile(emptyProfile);
        }
      } catch (fallbackError: any) {
        toast({
          title: "Error loading profile",
          description: fallbackError.message,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a PNG or SVG image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 1MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get the signed URL for private bucket
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('logos')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

      if (urlError) {
        throw urlError;
      }

      const logoUrl = signedUrlData.signedUrl;
      setLogoPreview(logoUrl);
      setProfile(prev => prev ? { ...prev, logo_url: logoUrl } : null);

      toast({
        title: "Logo uploaded",
        description: "Your logo has been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error uploading logo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!profile?.logo_url || !user) return;

    try {
      // Extract file path from URL
      const urlParts = profile.logo_url.split('/');
      const filePath = `${user.id}/${urlParts[urlParts.length - 1]}`;

      const { error } = await supabase.storage
        .from('logos')
        .remove([filePath]);

      if (error) {
        throw error;
      }

      setLogoPreview(null);
      setProfile(prev => prev ? { ...prev, logo_url: null } : null);

      toast({
        title: "Logo removed",
        description: "Your logo has been removed.",
      });
    } catch (error: any) {
      toast({
        title: "Error removing logo",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveProfile = async () => {
    if (!profile || !user) return;

    setSaving(true);
    setEncryptionError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('https://ollbuhgghkporvzmrzau.supabase.co/functions/v1/encrypted-profile-save', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: profile.company_name,
          address: profile.address,
          vat_id: profile.vat_id,
          bank_details: profile.bank_details,
          logo_url: profile.logo_url?.startsWith('https://') ? null : profile.logo_url
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        if (result.adminAction) {
          setEncryptionError(result.message);
        }
        throw new Error(result.message || 'Failed to save profile');
      }

      toast({
        title: "Profile saved",
        description: "Your profile has been updated securely.",
      });
      
      // Update original profile to current state
      setOriginalProfile({ ...profile });
      setHasChanges(false);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: "Error saving profile",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-10 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="h-20 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Building2 className="w-5 h-5 mr-2" />
          Company Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {encryptionError && (
          <Alert className="border-orange-200 bg-orange-50">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              <strong>Admin Configuration Required:</strong> {encryptionError}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Logo Upload */}
        <div className="space-y-2">
          <Label>Company Logo</Label>
          <div className="flex items-center space-x-3">
            {logoPreview ? (
              <div className="relative">
                <img
                  src={logoPreview}
                  alt="Company logo"
                  className="w-12 h-12 object-contain bg-muted rounded p-1"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-1 -right-1 w-4 h-4 p-0"
                  onClick={removeLogo}
                >
                  <X className="w-2 h-2" />
                </Button>
              </div>
            ) : (
              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                <Building2 className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            
            <div className="flex-1">
              <input
                type="file"
                accept="image/png,image/svg+xml,image/jpeg,image/jpg"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
                disabled={uploading}
              />
              <Label
                htmlFor="logo-upload"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-1 cursor-pointer"
              >
                <Upload className="w-3 h-3 mr-1" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                PNG, JPG or SVG, max 1MB
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="company-name">Company Name</Label>
            <Input
              id="company-name"
              value={profile.company_name || ''}
              onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Your Company Name"
              className="text-sm"
            />
          </div>

          {/* VAT ID */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-green-600" />
              <Label htmlFor="vat-id">VAT ID</Label>
              <span className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded-full">
                🔒 Encrypted
              </span>
            </div>
            <Input
              id="vat-id"
              value={profile.vat_id || ''}
              onChange={(e) => setProfile({ ...profile, vat_id: e.target.value })}
              placeholder="VAT123456789"
              className="text-sm"
              disabled={!!encryptionError}
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={profile.address || ''}
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            placeholder="Your company address"
            rows={2}
            className="text-sm"
          />
        </div>

        {/* Bank Details */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Lock className="w-4 h-4 text-green-600" />
            <Label htmlFor="bank-details">Bank Details</Label>
            <span className="text-xs text-muted-foreground bg-green-50 px-2 py-1 rounded-full">
              🔒 Encrypted
            </span>
          </div>
          <Textarea
            id="bank-details"
            value={profile.bank_details || ''}
            onChange={(e) => setProfile({ ...profile, bank_details: e.target.value })}
            placeholder="Bank name, account details, etc."
            rows={2}
            className="text-sm"
            disabled={!!encryptionError}
          />
          <p className="text-xs text-muted-foreground">
            Bank details are encrypted before storage and never transmitted in plaintext.
          </p>
        </div>

        <Button onClick={saveProfile} disabled={saving || !hasChanges} className="w-full">
          {saving ? 'Saving...' : 'Save Profile'}
        </Button>
      </CardContent>
    </Card>
  );
}