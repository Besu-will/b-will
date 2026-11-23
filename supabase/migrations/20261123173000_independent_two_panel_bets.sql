
-- Independent two-panel bets: one entry per player per panel, each with its own stake and selected cup.
alter table public.bwl_bets add column if not exists bet_slot smallint not null default 1;
alter table public.bwl_bets drop constraint if exists bwl_bets_round_id_user_id_key;
alter table public.bwl_bets add constraint bwl_bets_round_user_slot_key unique(round_id,user_id,bet_slot);
alter table public.bwl_bets add constraint bwl_bets_slot_check check (bet_slot between 1 and 2);

create or replace function public.bwl_place_bet(p_stake numeric,p_slot integer)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth'
as $function$
declare r public.bwl_round%rowtype; s public.bwl_settings%rowtype; p public.bwl_profiles%rowtype; old public.bwl_bets%rowtype; delta numeric;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_slot not between 1 and 2 then raise exception 'Invalid betting panel'; end if;
 select * into r from public.bwl_round where id=1 for update;
 select * into s from public.bwl_settings where id=1;
 if r.phase<>'picking' or r.phase_ends_at<=clock_timestamp() then raise exception 'Betting is only open while cups are being selected'; end if;
 if p_stake is null or p_stake<s.min_stake then raise exception 'Minimum stake is %',s.min_stake; end if;
 if p_stake<=0 then raise exception 'Enter a valid stake'; end if;
 select * into p from public.bwl_profiles where id=auth.uid() for update;
 select * into old from public.bwl_bets where round_id=r.round_id and user_id=auth.uid() and bet_slot=p_slot for update;
 delta:=p_stake-coalesce(old.stake,0);
 if delta>p.available then raise exception 'Insufficient available balance'; end if;
 update public.bwl_profiles set available=available-delta,locked=locked+delta where id=auth.uid();
 insert into public.bwl_bets(round_id,user_id,stake,cups,guesses,bet_slot) values(r.round_id,auth.uid(),p_stake,'{}'::integer[],'{}'::integer[],p_slot)
 on conflict(round_id,user_id,bet_slot) do update set stake=excluded.stake,cups='{}'::integer[],guesses='{}'::integer[],created_at=now();
 update public.bwl_round set total_pool=(select coalesce(sum(stake),0) from public.bwl_bets where round_id=r.round_id),
 bettors=(select count(distinct user_id) from public.bwl_bets where round_id=r.round_id) where id=1;
 return jsonb_build_object('slot',p_slot,'stake',p_stake);
end $function$;
revoke all on function public.bwl_place_bet(numeric,integer) from public,anon;
grant execute on function public.bwl_place_bet(numeric,integer) to authenticated;

create or replace function public.bwl_submit_guess(p_slot integer,p_cup integer)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth'
as $function$
declare r public.bwl_round%rowtype; b public.bwl_bets%rowtype; target integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_slot not between 1 and 2 or p_cup not between 1 and 3 then raise exception 'Invalid selection'; end if;
 select * into r from public.bwl_round where id=1 for update;
 if r.phase<>'picking' or r.phase_ends_at<=clock_timestamp() then raise exception 'Selection period is closed'; end if;
 select * into b from public.bwl_bets where round_id=r.round_id and user_id=auth.uid() and bet_slot=p_slot for update;
 if not found then raise exception 'Place this panel bet first'; end if;
 if cardinality(coalesce(b.guesses,'{}'::integer[]))>0 then raise exception 'This panel bet is already placed'; end if;
 update public.bwl_bets set guesses=array[p_cup],cups=array[p_cup] where id=b.id;
 select final_cup into target from public.bwl_round_secret where round_id=r.round_id;
 return jsonb_build_object('slot',p_slot,'cup',p_cup,'correct',target=p_cup);
end $function$;
revoke all on function public.bwl_submit_guess(integer,integer) from public,anon;
grant execute on function public.bwl_submit_guess(integer,integer) to authenticated;

create or replace function public.bwl_place_bet(p_stake numeric,p_slot integer,p_cup integer)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth'
as $function$
declare r public.bwl_round%rowtype; s public.bwl_settings%rowtype; p public.bwl_profiles%rowtype; b public.bwl_bets%rowtype; delta numeric; target integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_slot not between 1 and 2 or p_cup not between 1 and 3 then raise exception 'Choose a betting panel and a cup'; end if;
 select * into r from public.bwl_round where id=1 for update;
 select * into s from public.bwl_settings where id=1;
 if r.phase<>'picking' or r.phase_ends_at<=clock_timestamp() then raise exception 'Betting is closed'; end if;
 if p_stake is null or p_stake<s.min_stake then raise exception 'Minimum stake is %',s.min_stake; end if;
 select * into p from public.bwl_profiles where id=auth.uid() for update;
 select * into b from public.bwl_bets where round_id=r.round_id and user_id=auth.uid() and bet_slot=p_slot for update;
 if cardinality(coalesce(b.guesses,'{}'::integer[]))>0 then raise exception 'This betting panel has already been used this round'; end if;
 delta:=p_stake-coalesce(b.stake,0);
 if delta>p.available then raise exception 'Insufficient available balance'; end if;
 update public.bwl_profiles set available=available-delta,locked=locked+delta where id=auth.uid();
 insert into public.bwl_bets(round_id,user_id,stake,cups,guesses,bet_slot) values(r.round_id,auth.uid(),p_stake,array[p_cup],array[p_cup],p_slot)
 on conflict(round_id,user_id,bet_slot) do update set stake=excluded.stake,cups=excluded.cups,guesses=excluded.guesses,created_at=now();
 update public.bwl_round set total_pool=(select coalesce(sum(stake),0) from public.bwl_bets where round_id=r.round_id),
 bettors=(select count(distinct user_id) from public.bwl_bets where round_id=r.round_id) where id=1;
 select final_cup into target from public.bwl_round_secret where round_id=r.round_id;
 return jsonb_build_object('slot',p_slot,'stake',p_stake,'cup',p_cup,'correct',target=p_cup);
end $function$;
revoke all on function public.bwl_place_bet(numeric,integer,integer) from public,anon;
grant execute on function public.bwl_place_bet(numeric,integer,integer) to authenticated;
