-- =====================================================================
-- Migration: drop Supabase Auth, run natively on Auth0 (Third-Party Auth)
--
-- What this does:
--   1. Adds public.auth_uid() -- reads the trusted JWT's `sub` claim as
--      TEXT (works for Auth0's "auth0|..."/"google-oauth2|..." style IDs,
--      which are NOT valid Postgres UUIDs, unlike Supabase's own user ids).
--   2. Converts every user-identity column from uuid -> text and drops
--      the old FK to auth.users (Auth0 users are never rows in auth.users).
--   3. Updates has_role/is_blocked_between/push_notification/generate_username
--      to take TEXT ids instead of UUID.
--   4. Replaces every RLS policy's auth.uid() with public.auth_uid().
--   5. Retires the auth.users signup trigger (Auth0 never inserts there)
--      and replaces it with public.ensure_profile(), an RPC the app calls
--      right after login to upsert the profile/role/username -- same
--      first-user-becomes-admin bootstrap logic as before.
--
-- Requires: Supabase Dashboard -> Authentication -> Third-Party Auth
-- integration configured for your Auth0 tenant BEFORE this is meaningful
-- (otherwise PostgREST has no trusted issuer and every request is `anon`).
-- =====================================================================

-- 1) JWT sub reader (text, not uuid)
CREATE OR REPLACE FUNCTION public.auth_uid()
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')
$$;

-- 2) Drop every RLS policy that references a column we're about to retype
DROP POLICY IF EXISTS "Admins can delete ads" ON public.ads;
DROP POLICY IF EXISTS "Admins can insert ads" ON public.ads;
DROP POLICY IF EXISTS "Admins can update ads" ON public.ads;
DROP POLICY IF EXISTS "Anyone can view active ads" ON public.ads;
DROP POLICY IF EXISTS blocks_own_delete ON public.blocks;
DROP POLICY IF EXISTS blocks_own_insert ON public.blocks;
DROP POLICY IF EXISTS blocks_own_read ON public.blocks;
DROP POLICY IF EXISTS bug_admin_all ON public.bug_reports;
DROP POLICY IF EXISTS bug_user_insert ON public.bug_reports;
DROP POLICY IF EXISTS bug_user_read ON public.bug_reports;
DROP POLICY IF EXISTS call_signals_party_insert ON public.call_signals;
DROP POLICY IF EXISTS call_signals_party_read ON public.call_signals;
DROP POLICY IF EXISTS calls_caller_insert ON public.calls;
DROP POLICY IF EXISTS calls_party_read ON public.calls;
DROP POLICY IF EXISTS calls_party_update ON public.calls;
DROP POLICY IF EXISTS dm_party_read ON public.direct_messages;
DROP POLICY IF EXISTS dm_recipient_mark_read ON public.direct_messages;
DROP POLICY IF EXISTS dm_sender_delete ON public.direct_messages;
DROP POLICY IF EXISTS dm_sender_insert ON public.direct_messages;
DROP POLICY IF EXISTS dm_sender_update ON public.direct_messages;
DROP POLICY IF EXISTS listing_photos_owner_delete ON public.listing_photos;
DROP POLICY IF EXISTS listing_photos_owner_insert ON public.listing_photos;
DROP POLICY IF EXISTS listing_photos_read ON public.listing_photos;
DROP POLICY IF EXISTS listings_admin_delete ON public.listings;
DROP POLICY IF EXISTS listings_admin_update ON public.listings;
DROP POLICY IF EXISTS listings_owner_delete ON public.listings;
DROP POLICY IF EXISTS listings_owner_insert ON public.listings;
DROP POLICY IF EXISTS listings_owner_update ON public.listings;
DROP POLICY IF EXISTS listings_public_read ON public.listings;
DROP POLICY IF EXISTS notifications_own_delete ON public.notifications;
DROP POLICY IF EXISTS notifications_own_read ON public.notifications;
DROP POLICY IF EXISTS notifications_own_update ON public.notifications;
DROP POLICY IF EXISTS post_comments_delete ON public.post_comments;
DROP POLICY IF EXISTS post_comments_insert ON public.post_comments;
DROP POLICY IF EXISTS post_comments_read ON public.post_comments;
DROP POLICY IF EXISTS post_likes_delete ON public.post_likes;
DROP POLICY IF EXISTS post_likes_insert ON public.post_likes;
DROP POLICY IF EXISTS post_likes_read ON public.post_likes;
DROP POLICY IF EXISTS posts_owner_insert ON public.posts;
DROP POLICY IF EXISTS posts_owner_or_admin_delete ON public.posts;
DROP POLICY IF EXISTS posts_owner_update ON public.posts;
DROP POLICY IF EXISTS posts_public_read ON public.posts;
DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;
DROP POLICY IF EXISTS profiles_owner_upsert ON public.profiles;
DROP POLICY IF EXISTS profiles_public_read ON public.profiles;
DROP POLICY IF EXISTS reactions_owner_delete ON public.listing_reactions;
DROP POLICY IF EXISTS reactions_owner_insert ON public.listing_reactions;
DROP POLICY IF EXISTS reactions_owner_update ON public.listing_reactions;
DROP POLICY IF EXISTS reactions_public_read ON public.listing_reactions;
DROP POLICY IF EXISTS reports_admin_all ON public.reports;
DROP POLICY IF EXISTS reports_reporter_insert ON public.reports;
DROP POLICY IF EXISTS reports_reporter_read ON public.reports;
DROP POLICY IF EXISTS site_settings_admin_insert ON public.site_settings;
DROP POLICY IF EXISTS site_settings_admin_update ON public.site_settings;
DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;
DROP POLICY IF EXISTS user_roles_admin_delete ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_read ON public.user_roles;
DROP POLICY IF EXISTS user_roles_self_read ON public.user_roles;
DROP POLICY IF EXISTS wishlist_owner_delete ON public.wishlists;
DROP POLICY IF EXISTS wishlist_owner_insert ON public.wishlists;
DROP POLICY IF EXISTS wishlist_owner_read ON public.wishlists;
DROP POLICY IF EXISTS wishlists_owner_delete ON public.wishlists;
DROP POLICY IF EXISTS wishlists_owner_insert ON public.wishlists;
DROP POLICY IF EXISTS wishlists_owner_read ON public.wishlists;
DROP POLICY IF EXISTS "admins delete ads bucket" ON storage.objects;
DROP POLICY IF EXISTS "admins update ads bucket" ON storage.objects;
DROP POLICY IF EXISTS "admins upload ads bucket" ON storage.objects;
DROP POLICY IF EXISTS "avatars delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "avatars update own folder" ON storage.objects;
DROP POLICY IF EXISTS "avatars upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "listings delete own folder" ON storage.objects;
DROP POLICY IF EXISTS "listings update own folder" ON storage.objects;
DROP POLICY IF EXISTS "listings upload own folder" ON storage.objects;
DROP POLICY IF EXISTS "public read ads bucket" ON storage.objects;
DROP POLICY IF EXISTS "public read avatars bucket" ON storage.objects;
DROP POLICY IF EXISTS "public read listings bucket" ON storage.objects;

-- 3) Drop two-column CHECK constraints that would briefly compare
--    uuid <> text while their columns are converted one at a time
ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_check;
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_check;
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_check;

-- 3b) Drop old auth.users foreign keys
ALTER TABLE public.ads DROP CONSTRAINT IF EXISTS ads_created_by_fkey;
ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_blocked_id_fkey;
ALTER TABLE public.blocks DROP CONSTRAINT IF EXISTS blocks_blocker_id_fkey;
ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS bug_reports_user_id_fkey;
ALTER TABLE public.call_signals DROP CONSTRAINT IF EXISTS call_signals_sender_id_fkey;
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_callee_id_fkey;
ALTER TABLE public.calls DROP CONSTRAINT IF EXISTS calls_caller_id_fkey;
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_recipient_id_fkey;
ALTER TABLE public.direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_owner_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_actor_id_fkey;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_user_id_fkey;
ALTER TABLE public.post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- 4) Convert identity columns from uuid to text
ALTER TABLE public.ads ALTER COLUMN created_by TYPE text USING created_by::text;
ALTER TABLE public.blocks ALTER COLUMN blocked_id TYPE text USING blocked_id::text;
ALTER TABLE public.blocks ALTER COLUMN blocker_id TYPE text USING blocker_id::text;
ALTER TABLE public.bug_reports ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.call_signals ALTER COLUMN sender_id TYPE text USING sender_id::text;
ALTER TABLE public.calls ALTER COLUMN callee_id TYPE text USING callee_id::text;
ALTER TABLE public.calls ALTER COLUMN caller_id TYPE text USING caller_id::text;
ALTER TABLE public.direct_messages ALTER COLUMN recipient_id TYPE text USING recipient_id::text;
ALTER TABLE public.direct_messages ALTER COLUMN sender_id TYPE text USING sender_id::text;
ALTER TABLE public.listings ALTER COLUMN owner_id TYPE text USING owner_id::text;
ALTER TABLE public.notifications ALTER COLUMN actor_id TYPE text USING actor_id::text;
ALTER TABLE public.notifications ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.post_comments ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.post_likes ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.posts ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.profiles ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.reports ALTER COLUMN reporter_id TYPE text USING reporter_id::text;
ALTER TABLE public.user_roles ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.listing_reactions ALTER COLUMN user_id TYPE text USING user_id::text;
ALTER TABLE public.wishlists ALTER COLUMN user_id TYPE text USING user_id::text;

-- 4b) Restore the CHECK constraints now both sides are text
ALTER TABLE public.blocks ADD CONSTRAINT blocks_check CHECK (blocker_id <> blocked_id);
ALTER TABLE public.calls ADD CONSTRAINT calls_check CHECK (caller_id <> callee_id);
ALTER TABLE public.direct_messages ADD CONSTRAINT direct_messages_check CHECK (sender_id <> recipient_id);

-- 5) Update helper function signatures to text ids
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
CREATE OR REPLACE FUNCTION public.has_role(_user_id text, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

DROP FUNCTION IF EXISTS public.is_blocked_between(uuid, uuid);
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a text, _b text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_blocked_between(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.push_notification(uuid, uuid, text, text, text, uuid);
CREATE OR REPLACE FUNCTION public.push_notification(_user_id text, _actor_id text, _kind text, _title text, _body text, _entity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, actor_id, kind, title, body, entity_id)
  VALUES (_user_id, _actor_id, _kind, _title, _body, _entity_id);
END; $$;
REVOKE EXECUTE ON FUNCTION public.push_notification(text, text, text, text, text, uuid) FROM anon, authenticated, public;

DROP FUNCTION IF EXISTS public.generate_username(text, uuid);
CREATE OR REPLACE FUNCTION public.generate_username(_raw text, _user_id text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base text;
  candidate text;
  n int := 0;
BEGIN
  base := public.slugify_username(_raw);
  IF base IS NULL OR length(base) < 3 THEN
    base := 'user' || substring(md5(_user_id) from 1 for 8);
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
REVOKE ALL ON FUNCTION public.generate_username(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_username(text, text) TO service_role;

-- 6) Retire the Supabase-Auth signup trigger; Auth0 never inserts into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Replacement: the app calls this once right after an Auth0 login to
-- upsert the profile row + username, and to assign a role the first time
-- it sees this user (first-ever user becomes admin, same bootstrap rule
-- as before).
CREATE OR REPLACE FUNCTION public.ensure_profile(
  _id text,
  _display_name text,
  _avatar_url text,
  _username_hint text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_count int;
  uname text;
BEGIN
  IF _id IS NULL OR _id = '' THEN
    RAISE EXCEPTION 'ensure_profile: empty user id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _id) THEN
    uname := public.generate_username(COALESCE(_username_hint, _display_name), _id);
    INSERT INTO public.profiles(id, display_name, avatar_url, username)
    VALUES (_id, _display_name, _avatar_url, uname)
    ON CONFLICT (id) DO NOTHING;
  ELSE
    UPDATE public.profiles
      SET display_name = COALESCE(_display_name, display_name),
          avatar_url = COALESCE(_avatar_url, avatar_url)
      WHERE id = _id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _id) THEN
    SELECT COUNT(*) INTO role_count FROM public.user_roles;
    IF role_count = 0 THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (_id, 'admin') ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.user_roles(user_id, role) VALUES (_id, 'user') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_profile(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_profile(text, text, text, text) TO authenticated;

-- 7) Recreate every RLS policy (including Storage), now pointing at public.auth_uid()
CREATE POLICY "Admins can delete ads" ON public.ads FOR DELETE TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert ads" ON public.ads FOR INSERT TO authenticated WITH CHECK (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update ads" ON public.ads FOR UPDATE TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view active ads" ON public.ads FOR SELECT USING (((is_active = true) OR public.has_role(public.auth_uid(), 'admin'::public.app_role)));

CREATE POLICY blocks_own_delete ON public.blocks FOR DELETE TO authenticated USING ((public.auth_uid() = blocker_id));

CREATE POLICY blocks_own_insert ON public.blocks FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = blocker_id));

CREATE POLICY blocks_own_read ON public.blocks FOR SELECT TO authenticated USING (((public.auth_uid() = blocker_id) OR (public.auth_uid() = blocked_id)));

CREATE POLICY bug_admin_all ON public.bug_reports TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY bug_user_insert ON public.bug_reports FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = user_id));

CREATE POLICY bug_user_read ON public.bug_reports FOR SELECT TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY call_signals_party_insert ON public.call_signals FOR INSERT TO authenticated WITH CHECK (((public.auth_uid() = sender_id) AND (EXISTS ( SELECT 1
   FROM public.calls c
  WHERE ((c.id = call_signals.call_id) AND ((public.auth_uid() = c.caller_id) OR (public.auth_uid() = c.callee_id)))))));

CREATE POLICY call_signals_party_read ON public.call_signals FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.calls c
  WHERE ((c.id = call_signals.call_id) AND ((public.auth_uid() = c.caller_id) OR (public.auth_uid() = c.callee_id))))));

CREATE POLICY calls_caller_insert ON public.calls FOR INSERT TO authenticated WITH CHECK (((public.auth_uid() = caller_id) AND (NOT public.is_blocked_between(caller_id, callee_id))));

CREATE POLICY calls_party_read ON public.calls FOR SELECT TO authenticated USING (((public.auth_uid() = caller_id) OR (public.auth_uid() = callee_id)));

CREATE POLICY calls_party_update ON public.calls FOR UPDATE TO authenticated USING (((public.auth_uid() = caller_id) OR (public.auth_uid() = callee_id))) WITH CHECK (((public.auth_uid() = caller_id) OR (public.auth_uid() = callee_id)));

CREATE POLICY dm_party_read ON public.direct_messages FOR SELECT TO authenticated USING (((public.auth_uid() = sender_id) OR (public.auth_uid() = recipient_id)));

CREATE POLICY dm_recipient_mark_read ON public.direct_messages FOR UPDATE TO authenticated USING ((public.auth_uid() = recipient_id)) WITH CHECK ((public.auth_uid() = recipient_id));

CREATE POLICY dm_sender_delete ON public.direct_messages FOR DELETE TO authenticated USING ((public.auth_uid() = sender_id));

CREATE POLICY dm_sender_insert ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (((public.auth_uid() = sender_id) AND (NOT public.is_blocked_between(sender_id, recipient_id))));

CREATE POLICY dm_sender_update ON public.direct_messages FOR UPDATE TO authenticated USING ((public.auth_uid() = sender_id)) WITH CHECK ((public.auth_uid() = sender_id));

CREATE POLICY listing_photos_owner_delete ON public.listing_photos FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = listing_photos.listing_id) AND (l.owner_id = public.auth_uid())))) OR public.has_role(public.auth_uid(), 'admin'::public.app_role)));

CREATE POLICY listing_photos_owner_insert ON public.listing_photos FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.listings l
  WHERE ((l.id = listing_photos.listing_id) AND (l.owner_id = public.auth_uid())))));

CREATE POLICY listing_photos_read ON public.listing_photos FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY listings_admin_delete ON public.listings FOR DELETE TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY listings_admin_update ON public.listings FOR UPDATE TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY listings_owner_delete ON public.listings FOR DELETE TO authenticated USING ((public.auth_uid() = owner_id));

CREATE POLICY listings_owner_insert ON public.listings FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = owner_id));

CREATE POLICY listings_owner_update ON public.listings FOR UPDATE TO authenticated USING ((public.auth_uid() = owner_id));

CREATE POLICY listings_public_read ON public.listings FOR SELECT USING (true);

CREATE POLICY notifications_own_delete ON public.notifications FOR DELETE TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY notifications_own_read ON public.notifications FOR SELECT TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated USING ((public.auth_uid() = user_id)) WITH CHECK ((public.auth_uid() = user_id));

CREATE POLICY post_comments_delete ON public.post_comments FOR DELETE TO authenticated USING (((user_id = public.auth_uid()) OR public.has_role(public.auth_uid(), 'admin'::public.app_role)));

CREATE POLICY post_comments_insert ON public.post_comments FOR INSERT TO authenticated WITH CHECK ((user_id = public.auth_uid()));

CREATE POLICY post_comments_read ON public.post_comments FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY post_likes_delete ON public.post_likes FOR DELETE TO authenticated USING ((user_id = public.auth_uid()));

CREATE POLICY post_likes_insert ON public.post_likes FOR INSERT TO authenticated WITH CHECK ((user_id = public.auth_uid()));

CREATE POLICY post_likes_read ON public.post_likes FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY posts_owner_insert ON public.posts FOR INSERT TO authenticated WITH CHECK ((user_id = public.auth_uid()));

CREATE POLICY posts_owner_or_admin_delete ON public.posts FOR DELETE TO authenticated USING (((user_id = public.auth_uid()) OR public.has_role(public.auth_uid(), 'admin'::public.app_role)));

CREATE POLICY posts_owner_update ON public.posts FOR UPDATE TO authenticated USING ((user_id = public.auth_uid())) WITH CHECK ((user_id = public.auth_uid()));

CREATE POLICY posts_public_read ON public.posts FOR SELECT TO anon, authenticated USING (((expires_at IS NULL) OR (expires_at > now()) OR (user_id = public.auth_uid())));

CREATE POLICY profiles_owner_update ON public.profiles FOR UPDATE TO authenticated USING ((public.auth_uid() = id));

CREATE POLICY profiles_owner_upsert ON public.profiles FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = id));

CREATE POLICY profiles_public_read ON public.profiles FOR SELECT USING (true);

CREATE POLICY reactions_owner_delete ON public.listing_reactions FOR DELETE TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY reactions_owner_insert ON public.listing_reactions FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = user_id));

CREATE POLICY reactions_owner_update ON public.listing_reactions FOR UPDATE TO authenticated USING ((public.auth_uid() = user_id)) WITH CHECK ((public.auth_uid() = user_id));

CREATE POLICY reactions_public_read ON public.listing_reactions FOR SELECT USING (true);

CREATE POLICY reports_admin_all ON public.reports TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY reports_reporter_insert ON public.reports FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = reporter_id));

CREATE POLICY reports_reporter_read ON public.reports FOR SELECT TO authenticated USING ((public.auth_uid() = reporter_id));

CREATE POLICY site_settings_admin_insert ON public.site_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY site_settings_admin_update ON public.site_settings FOR UPDATE TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY site_settings_public_read ON public.site_settings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY user_roles_admin_delete ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY user_roles_admin_insert ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY user_roles_admin_read ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(public.auth_uid(), 'admin'::public.app_role));

CREATE POLICY user_roles_self_read ON public.user_roles FOR SELECT TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY wishlist_owner_delete ON public.wishlists FOR DELETE TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY wishlist_owner_insert ON public.wishlists FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = user_id));

CREATE POLICY wishlist_owner_read ON public.wishlists FOR SELECT TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY wishlists_owner_delete ON public.wishlists FOR DELETE TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY wishlists_owner_insert ON public.wishlists FOR INSERT TO authenticated WITH CHECK ((public.auth_uid() = user_id));

CREATE POLICY wishlists_owner_read ON public.wishlists FOR SELECT TO authenticated USING ((public.auth_uid() = user_id));

CREATE POLICY "admins delete ads bucket" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'ads'::text) AND public.has_role(public.auth_uid(), 'admin'::public.app_role)));

CREATE POLICY "admins update ads bucket" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'ads'::text) AND public.has_role(public.auth_uid(), 'admin'::public.app_role)));

CREATE POLICY "admins upload ads bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'ads'::text) AND public.has_role(public.auth_uid(), 'admin'::public.app_role)));

CREATE POLICY "avatars delete own folder" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = public.auth_uid())));

CREATE POLICY "avatars update own folder" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = public.auth_uid())));

CREATE POLICY "avatars upload own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = public.auth_uid())));

CREATE POLICY "listings delete own folder" ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'listings'::text) AND ((storage.foldername(name))[1] = public.auth_uid())));

CREATE POLICY "listings update own folder" ON storage.objects FOR UPDATE TO authenticated USING (((bucket_id = 'listings'::text) AND ((storage.foldername(name))[1] = public.auth_uid())));

CREATE POLICY "listings upload own folder" ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'listings'::text) AND ((storage.foldername(name))[1] = public.auth_uid())));

CREATE POLICY "public read ads bucket" ON storage.objects FOR SELECT USING ((bucket_id = 'ads'::text));

CREATE POLICY "public read avatars bucket" ON storage.objects FOR SELECT USING ((bucket_id = 'avatars'::text));

CREATE POLICY "public read listings bucket" ON storage.objects FOR SELECT USING ((bucket_id = 'listings'::text));
