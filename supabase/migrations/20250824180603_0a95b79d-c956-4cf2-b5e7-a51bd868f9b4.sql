-- Ensure comprehensive RLS policies for all core tables

-- Clients table policies
DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
CREATE POLICY "own_clients_read" ON public.clients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_clients_write" ON public.clients FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_clients_update" ON public.clients FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_clients_delete" ON public.clients FOR DELETE USING (user_id = auth.uid());

-- Projects table policies
DROP POLICY IF EXISTS "Users can manage their own projects" ON public.projects;
CREATE POLICY "own_projects_read" ON public.projects FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_projects_write" ON public.projects FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_projects_update" ON public.projects FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_projects_delete" ON public.projects FOR DELETE USING (user_id = auth.uid());

-- Time entries table policies
DROP POLICY IF EXISTS "Users can manage their own time entries" ON public.time_entries;
CREATE POLICY "own_time_entries_read" ON public.time_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_time_entries_write" ON public.time_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_time_entries_update" ON public.time_entries FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_time_entries_delete" ON public.time_entries FOR DELETE USING (user_id = auth.uid());

-- Reminders table policies  
DROP POLICY IF EXISTS "Users can manage their own reminders" ON public.reminders;
CREATE POLICY "own_reminders_read" ON public.reminders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "own_reminders_write" ON public.reminders FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "own_reminders_update" ON public.reminders FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "own_reminders_delete" ON public.reminders FOR DELETE USING (user_id = auth.uid());

-- Enable realtime for time_entries to support live updates
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;