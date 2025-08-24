-- Add timer_skin column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN timer_skin text NOT NULL DEFAULT 'classic';

-- Add check constraint to ensure valid skin values
ALTER TABLE public.profiles 
ADD CONSTRAINT timer_skin_check 
CHECK (timer_skin IN ('classic', 'minimal', 'digital', 'gradient'));