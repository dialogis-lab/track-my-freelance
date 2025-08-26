-- Add Free plan database guardrails

-- Is the current user on Free?
CREATE OR REPLACE FUNCTION public.is_free_user(p_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql 
STABLE SECURITY DEFINER 
SET search_path = public 
AS $$
  SELECT COALESCE(LOWER(stripe_subscription_status) NOT IN ('active','trialing'), true)
  FROM profiles WHERE id = p_user
$$;

-- Guard: max 1 client for Free
CREATE OR REPLACE FUNCTION public.trg_clients_free_limit()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE 
  cnt int;
BEGIN
  IF is_free_user() THEN
    SELECT count(*) INTO cnt FROM clients WHERE user_id = auth.uid() AND NOT archived;
    IF cnt >= 1 THEN
      RAISE EXCEPTION 'FREE_LIMIT_CLIENTS_REACHED';
    END IF;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS t_clients_free_limit ON clients;
CREATE TRIGGER t_clients_free_limit 
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION trg_clients_free_limit();

-- Guard: max 1 project for Free
CREATE OR REPLACE FUNCTION public.trg_projects_free_limit()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public 
AS $$
DECLARE 
  cnt int;
BEGIN
  IF is_free_user() THEN
    SELECT count(*) INTO cnt FROM projects WHERE user_id = auth.uid() AND NOT archived;
    IF cnt >= 1 THEN
      RAISE EXCEPTION 'FREE_LIMIT_PROJECTS_REACHED';
    END IF;
  END IF;
  RETURN new;
END $$;

DROP TRIGGER IF EXISTS t_projects_free_limit ON projects;
CREATE TRIGGER t_projects_free_limit 
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION trg_projects_free_limit();