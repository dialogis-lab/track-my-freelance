-- Create profiles table with auto-population trigger
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  address text,
  vat_id text,
  bank_details text,
  logo_url text,
  subscription_status text default 'free',
  subscription_plan text,
  subscription_current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_status text,
  stripe_current_period_end timestamptz,
  stripe_price_id text,
  onboarding_state jsonb default '{"dismissed": false, "tour_done": false, "completed_at": null, "expense_added": false, "timer_started": false, "project_created": false, "stripe_connected": false, "invoice_draft_created": false, "timer_stopped_with_note": false}',
  timer_skin text not null default 'classic',
  vat_id_enc jsonb,
  bank_details_enc jsonb,
  iban_fp bytea,
  vat_fp bytea,
  billing_email_fp bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Create trigger function to auto-populate profiles on user signup
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

-- Drop existing trigger if it exists
drop trigger if exists on_auth_user_created on auth.users;

-- Create trigger to auto-populate profiles
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS policies: users can select/update their own profile
do $$
begin
  -- Drop existing policies if they exist
  drop policy if exists "profiles_select_own" on public.profiles;
  drop policy if exists "profiles_update_own" on public.profiles;
  drop policy if exists "profiles_insert_own" on public.profiles;
  
  -- Create new policies
  create policy "Users can view their own profile" on public.profiles
    for select using (auth.uid() = id);
  
  create policy "Users can update their own profile" on public.profiles
    for update using (auth.uid() = id);
    
  create policy "Users can insert their own profile" on public.profiles
    for insert with check (auth.uid() = id);
end$$;

-- Backfill existing users (ensure existing users get profiles)
insert into public.profiles (id, created_at, updated_at)
select 
  id, 
  coalesce(created_at, now()),
  coalesce(updated_at, now())
from auth.users
on conflict (id) do nothing;