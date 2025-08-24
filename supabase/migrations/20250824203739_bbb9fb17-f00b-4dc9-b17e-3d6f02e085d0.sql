-- Promote the TimeHatch user to admin
INSERT INTO user_roles (user_id, role) 
VALUES ('7abc1e44-6c7d-404a-bd79-e794efbd5747', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the role was assigned
SELECT 
  p.id,
  p.company_name,
  ur.role,
  p.created_at
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
WHERE p.id = '7abc1e44-6c7d-404a-bd79-e794efbd5747';