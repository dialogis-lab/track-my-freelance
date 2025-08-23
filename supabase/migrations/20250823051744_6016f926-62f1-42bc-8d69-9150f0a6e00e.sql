-- Create leads table for email collection
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to insert leads (for public signup)
CREATE POLICY "Anyone can insert leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (true);

-- Create policy to prevent reading leads (admin only via direct DB access)
CREATE POLICY "No public read access to leads" 
ON public.leads 
FOR SELECT 
USING (false);