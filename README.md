# B-Will
A three-cup multiplayer prediction web app backed by Supabase Auth, Postgres, RLS, Realtime and a server-side pg_cron round engine.

## Render deployment
Create a Static Site from this repository, branch main, build command npm run build, publish directory dist. Set:
- SUPABASE_URL: Supabase project URL
- SUPABASE_PUBLISHABLE_KEY: Supabase publishable key (never expose a service-role key)
- ADMIN_EMAIL: the sole administrator email

The database's protected public.bwl_private.admin_email value is the authorization source and must match ADMIN_EMAIL. Admin checks require a confirmed Supabase Auth email. The frontend does not decide admin privileges.

## Supabase
Production schema, server-side game settlement, wallet RPCs, RLS and the one-second cron job are managed by Supabase. Stakes, balance changes, payouts, request approvals and leaderboard resets run inside guarded Postgres functions.
