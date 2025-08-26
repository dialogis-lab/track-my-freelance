-- Add composite indexes for efficient keyset pagination on time entries
create index if not exists idx_time_entries_user_started_id
  on time_entries (user_id, started_at desc, id desc);

create index if not exists idx_time_entries_project 
  on time_entries (project_id);

create index if not exists idx_projects_client 
  on projects (client_id);