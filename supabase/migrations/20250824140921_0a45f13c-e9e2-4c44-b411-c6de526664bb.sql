-- Create table for MFA recovery codes
CREATE TABLE public.mfa_recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Create policies for MFA recovery codes
CREATE POLICY "Users can insert their own recovery codes" 
ON public.mfa_recovery_codes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select their own recovery codes" 
ON public.mfa_recovery_codes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own recovery codes" 
ON public.mfa_recovery_codes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recovery codes" 
ON public.mfa_recovery_codes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_mfa_recovery_codes_user_id ON public.mfa_recovery_codes(user_id);
CREATE INDEX idx_mfa_recovery_codes_code_hash ON public.mfa_recovery_codes(code_hash);