-- 1. Column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- 2. Slug helper (immutable, no table access)
CREATE OR REPLACE FUNCTION public.slugify_username(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    substring(
      regexp_replace(lower(coalesce(_raw, '')), '[^a-z0-9._]+', '', 'g')
      from 1 for 20
    ), ''
  )
$$;

-- 3. Unique-username generator
CREATE OR REPLACE FUNCTION public.generate_username(_raw text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := public.slugify_username(_raw);
  IF base IS NULL OR length(base) < 3 THEN
    base := 'user' || substring(replace(_user_id::text, '-', '') from 1 for 8);
  END IF;
  candidate := base;
  LOOP
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE lower(username) = lower(candidate) AND id <> _user_id
    );
    n := n + 1;
    candidate := substring(base from 1 for 16) || n::text;
  END LOOP;
  RETURN candidate;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_username(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_username(text, uuid) TO authenticated, service_role;

-- 4. Backfill existing profiles
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, display_name FROM public.profiles WHERE username IS NULL LOOP
    UPDATE public.profiles
      SET username = public.generate_username(r.display_name, r.id)
      WHERE id = r.id;
  END LOOP;
END $$;

-- 5. Constraints
ALTER TABLE public.profiles ALTER COLUMN username SET NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-zA-Z0-9._]{3,20}$');
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS profiles_display_name_idx ON public.profiles (lower(display_name));

-- 6. New signups get a username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_count int;
  uname text;
BEGIN
  uname := public.generate_username(
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.raw_user_meta_data->>'display_name',
             NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    NEW.id);

  INSERT INTO public.profiles(id, display_name, avatar_url, username)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'avatar_url',
          uname)
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO role_count FROM public.user_roles;

  IF role_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
