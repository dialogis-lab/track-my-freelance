-- Fix missing profiles issue by ensuring all users have a profile
-- Create profiles for existing users who don't have one
INSERT INTO public.profiles (id, created_at, updated_at)
SELECT 
  u.id,
  u.created_at,
  now()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;