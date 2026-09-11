
-- 1) Enforce max 3 listings per owner
CREATE OR REPLACE FUNCTION public.enforce_listing_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.listings WHERE owner_id = NEW.owner_id) >= 3 THEN
    RAISE EXCEPTION 'Batas maksimal 3 jualan per akun sudah tercapai. Gunakan akun lain untuk menambah.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_listing_limit ON public.listings;
CREATE TRIGGER trg_enforce_listing_limit
BEFORE INSERT ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_limit();

-- 2) Reactions table (like/dislike)
CREATE TYPE public.reaction_type AS ENUM ('like','dislike');

CREATE TABLE public.listing_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reaction public.reaction_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_reactions TO authenticated;
GRANT SELECT ON public.listing_reactions TO anon;
GRANT ALL ON public.listing_reactions TO service_role;

ALTER TABLE public.listing_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY reactions_public_read ON public.listing_reactions
  FOR SELECT USING (true);
CREATE POLICY reactions_owner_insert ON public.listing_reactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY reactions_owner_update ON public.listing_reactions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY reactions_owner_delete ON public.listing_reactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_reactions_listing ON public.listing_reactions(listing_id);
