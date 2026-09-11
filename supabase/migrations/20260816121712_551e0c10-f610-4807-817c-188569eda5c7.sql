-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_own_read ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY notifications_own_delete ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.push_notification(_user_id uuid, _actor_id uuid, _kind text, _title text, _body text, _entity_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = _actor_id THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, actor_id, kind, title, body, entity_id)
  VALUES (_user_id, _actor_id, _kind, _title, _body, _entity_id);
END; $$;

CREATE OR REPLACE FUNCTION public.tg_notify_friendship()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    SELECT COALESCE(display_name, username) INTO nm FROM public.profiles WHERE id = NEW.requester_id;
    PERFORM public.push_notification(NEW.addressee_id, NEW.requester_id, 'friend_request',
      'Permintaan pertemanan baru', COALESCE(nm,'Seseorang') || ' ingin berteman denganmu.', NEW.id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    SELECT COALESCE(display_name, username) INTO nm FROM public.profiles WHERE id = NEW.addressee_id;
    PERFORM public.push_notification(NEW.requester_id, NEW.addressee_id, 'friend_accept',
      'Permintaan diterima', COALESCE(nm,'Seseorang') || ' menerima permintaan pertemananmu.', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER friendships_notify AFTER INSERT OR UPDATE ON public.friendships
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_friendship();

CREATE OR REPLACE FUNCTION public.tg_notify_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  SELECT COALESCE(display_name, username) INTO nm FROM public.profiles WHERE id = NEW.follower_id;
  PERFORM public.push_notification(NEW.following_id, NEW.follower_id, 'follow',
    'Pengikut baru', COALESCE(nm,'Seseorang') || ' mulai mengikutimu.', NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER follows_notify AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_follow();

CREATE OR REPLACE FUNCTION public.tg_notify_dm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  SELECT COALESCE(display_name, username) INTO nm FROM public.profiles WHERE id = NEW.sender_id;
  PERFORM public.push_notification(NEW.recipient_id, NEW.sender_id, 'message',
    'Pesan baru dari ' || COALESCE(nm,'Pengguna'),
    COALESCE(NULLIF(left(COALESCE(NEW.body,''), 80), ''), 'Mengirim lampiran'), NEW.sender_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER dm_notify AFTER INSERT ON public.direct_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_dm();

CREATE OR REPLACE FUNCTION public.tg_notify_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nm text;
BEGIN
  SELECT COALESCE(display_name, username) INTO nm FROM public.profiles WHERE id = NEW.caller_id;
  PERFORM public.push_notification(NEW.callee_id, NEW.caller_id, 'call',
    'Panggilan suara masuk', COALESCE(nm,'Seseorang') || ' menelepon kamu.', NEW.id);
  RETURN NEW;
END; $$;
CREATE TRIGGER calls_notify AFTER INSERT ON public.calls
FOR EACH ROW EXECUTE FUNCTION public.tg_notify_call();

-- STORIES
CREATE TABLE public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  listing_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stories_active_idx ON public.stories(expires_at DESC);
GRANT SELECT, INSERT, DELETE ON public.stories TO authenticated;
GRANT SELECT ON public.stories TO anon;
GRANT ALL ON public.stories TO service_role;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY stories_active_read ON public.stories FOR SELECT USING (expires_at > now() OR auth.uid() = user_id);
CREATE POLICY stories_owner_insert ON public.stories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY stories_owner_delete ON public.stories FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, viewer_id)
);
GRANT SELECT, INSERT ON public.story_views TO authenticated;
GRANT ALL ON public.story_views TO service_role;
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY story_views_insert ON public.story_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY story_views_read ON public.story_views FOR SELECT TO authenticated USING (
  auth.uid() = viewer_id OR EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_views.story_id AND s.user_id = auth.uid())
);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;