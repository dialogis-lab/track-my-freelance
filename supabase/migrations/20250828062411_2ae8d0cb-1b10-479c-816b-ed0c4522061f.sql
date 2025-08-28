-- Ensure profiles table exists and has proper trigger for auto-population
-- Only create/update what doesn't exist to avoid conflicts

-- Update the trigger function to ensure it populates profiles correctly
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, company_name)
  values (new.id, new.raw_user_meta_data ->> 'company_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users who don't have profile records
insert into public.profiles (id, created_at, updated_at)
select 
  auth_users.id, 
  coalesce(auth_users.created_at, now()),
  now()
from auth.users auth_users
left join public.profiles on auth_users.id = profiles.id
where profiles.id is null;