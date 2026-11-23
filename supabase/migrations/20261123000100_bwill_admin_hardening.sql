-- B-Will production hardening. Safe to re-run.
BEGIN;
UPDATE public.bwl_private SET admin_email='befetarifkad@gmail.com' WHERE id=1;
INSERT INTO public.bwl_profiles(id,username,email)
SELECT u.id,'admin',u.email FROM auth.users u
WHERE lower(u.email)=lower('befetarifkad@gmail.com')
AND NOT EXISTS(SELECT 1 FROM public.bwl_profiles p WHERE p.id=u.id)
ON CONFLICT(id) DO NOTHING;
COMMENT ON COLUMN public.bwl_private.admin_email IS 'Single administrator email; keep aligned with deployment ADMIN_EMAIL. Admin checks require a confirmed Supabase Auth email.';
REVOKE ALL ON FUNCTION public.bwl_tick() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.bwl_tick() TO postgres;
CREATE INDEX IF NOT EXISTS bwl_bets_round_id_idx ON public.bwl_bets(round_id);
CREATE INDEX IF NOT EXISTS bwl_requests_user_created_idx ON public.bwl_requests(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS bwl_requests_status_created_idx ON public.bwl_requests(status,created_at DESC);
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='bwl_leaderboard_history') THEN
ALTER PUBLICATION supabase_realtime ADD TABLE public.bwl_leaderboard_history;
END IF;
END $$;
COMMIT;