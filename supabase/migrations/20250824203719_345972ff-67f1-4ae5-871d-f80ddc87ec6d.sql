-- Promote current user to admin (replace the email with your actual email)
-- First, let's see all users and their current roles
SELECT 
  p.id,
  p.company_name,
  ur.role,
  p.created_at
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
ORDER BY p.created_at DESC;

-- To promote a specific user to admin, you'll need to:
-- 1. Find your user_id from the profiles table above
-- 2. Delete the existing 'user' role
-- 3. Insert the 'admin' role

-- Example: Replace 'YOUR_USER_ID_HERE' with your actual user ID from the query above
-- DELETE FROM user_roles WHERE user_id = 'YOUR_USER_ID_HERE';
-- INSERT INTO user_roles (user_id, role) VALUES ('YOUR_USER_ID_HERE', 'admin');