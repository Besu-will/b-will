-- B-Will: three-cup shuffle gameplay with two guesses per staked player.
-- Existing stake, pool distribution, house cut and leaderboard rules are preserved.

alter table public.bwl_round drop constraint if exists bwl_round_phase_check;
alter table public.bwl_round add constraint bwl_round_phase_check
  check (phase = any (array['betting','preview','shuffle','picking','reveal']));

alter table public.bwl_bets drop constraint if exists bwl_bets_cups_check;
alter table public.bwl_bets add column if not exists guesses integer[] not null default '{}'::integer[];
alter table public.bwl_bets alter column cups set default '{}'::integer[];
alter table public.bwl_bets add constraint bwl_bets_cups_check
  check (cardinality(cups) in (0,2) and (cardinality(cups)=0 or
    (cups[1] between 1 and 3 and cups[2] between 1 and 3 and cups[1]<>cups[2])));
alter table public.bwl_bets add constraint bwl_bets_guesses_check
  check (cardinality(guesses)<=2 and
    (cardinality(guesses)=0 or guesses[1] between 1 and 3) and
    (cardinality(guesses)<2 or (guesses[2] between 1 and 3 and guesses[1]<>guesses[2])));

create table if not exists public.bwl_round_secret (
  round_id bigint primary key,
  starting_cup integer not null check (starting_cup between 1 and 3),
  shuffle_order integer[] not null check (
    cardinality(shuffle_order)=3 and
    shuffle_order[1] between 1 and 3 and shuffle_order[2] between 1 and 3 and shuffle_order[3] between 1 and 3 and
    shuffle_order[1]<>shuffle_order[2] and shuffle_order[1]<>shuffle_order[3] and shuffle_order[2]<>shuffle_order[3]
  ),
  final_cup integer not null check (final_cup between 1 and 3),
  created_at timestamptz not null default now()
);
alter table public.bwl_round_secret enable row level security;
revoke all on public.bwl_round_secret from anon, authenticated;

drop function if exists public.bwl_place_bet(numeric, integer[]);
create or replace function public.bwl_place_bet(p_stake numeric)
returns void language plpgsql security definer
set search_path to 'pg_catalog','public','auth'
as $function$
declare r public.bwl_round%rowtype; s public.bwl_settings%rowtype; p public.bwl_profiles%rowtype;
old public.bwl_bets%rowtype; delta numeric;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into r from public.bwl_round where id=1 for update;
  select * into s from public.bwl_settings where id=1;
  if r.phase<>'betting' or r.phase_ends_at<=now() then raise exception 'Betting is closed'; end if;
  if p_stake is null or p_stake<s.min_stake then raise exception 'Minimum stake is %',s.min_stake; end if;
  if p_stake<=0 then raise exception 'Enter a valid stake'; end if;
  select * into p from public.bwl_profiles where id=auth.uid() for update;
  select * into old from public.bwl_bets where round_id=r.round_id and user_id=auth.uid() for update;
  delta:=p_stake-coalesce(old.stake,0);
  if delta>p.available then raise exception 'Insufficient available balance'; end if;
  update public.bwl_profiles set available=available-delta,locked=locked+delta where id=auth.uid();
  insert into public.bwl_bets(round_id,user_id,stake,cups,guesses)
  values(r.round_id,auth.uid(),p_stake,'{}'::integer[],'{}'::integer[])
  on conflict(round_id,user_id) do update
    set stake=excluded.stake,cups='{}'::integer[],guesses='{}'::integer[],created_at=now();
  update public.bwl_round set
    total_pool=(select coalesce(sum(stake),0) from public.bwl_bets where round_id=r.round_id),
    bettors=(select count(*) from public.bwl_bets where round_id=r.round_id)
  where id=1;
end
$function$;

create or replace function public.bwl_guess(p_cup integer)
returns jsonb language plpgsql security definer
set search_path to 'pg_catalog','public','auth'
as $function$
declare r public.bwl_round%rowtype; secret public.bwl_round_secret%rowtype;
b public.bwl_bets%rowtype; next_guesses integer[]; found_item boolean;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_cup is null or p_cup not between 1 and 3 then raise exception 'Choose one of the three cups'; end if;
  select * into r from public.bwl_round where id=1 for update;
  if r.phase<>'picking' or r.phase_ends_at<=clock_timestamp() then raise exception 'The guessing period is closed'; end if;
  select * into b from public.bwl_bets where round_id=r.round_id and user_id=auth.uid() for update;
  if not found then raise exception 'Place a stake before the shuffle to play'; end if;
  if cardinality(b.guesses)>=2 then raise exception 'You have used both guesses'; end if;
  select * into secret from public.bwl_round_secret where round_id=r.round_id;
  if secret.final_cup=any(b.guesses) then raise exception 'You already found the item'; end if;
  if p_cup=any(b.guesses) then raise exception 'Choose a different cup for your next guess'; end if;
  next_guesses:=array_append(coalesce(b.guesses,'{}'::integer[]),p_cup);
  found_item:=secret.final_cup=any(next_guesses);
  update public.bwl_bets set guesses=next_guesses where id=b.id;
  return jsonb_build_object('guesses',next_guesses,'correct',found_item,'attempts_left',2-cardinality(next_guesses));
end
$function$;

create or replace function public.bwl_game_state()
returns jsonb language plpgsql stable security definer
set search_path to 'pg_catalog','public','auth'
as $function$
declare r public.bwl_round%rowtype; secret public.bwl_round_secret%rowtype;
own_guesses integer[]:='{}'::integer[];
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into r from public.bwl_round where id=1;
  select * into secret from public.bwl_round_secret where round_id=r.round_id;
  select coalesce(guesses,'{}'::integer[]) into own_guesses
    from public.bwl_bets where round_id=r.round_id and user_id=auth.uid();
  return jsonb_build_object(
    'starting_cup',case when r.phase in ('preview','shuffle','picking','reveal') then secret.starting_cup else null end,
    'shuffle_order',case when r.phase in ('shuffle','picking','reveal') then secret.shuffle_order else null end,
    'guesses',coalesce(own_guesses,'{}'::integer[]),
    'revealed_cup',case when r.phase='reveal' then r.revealed_cup else null end
  );
end
$function$;

create or replace function public.bwl_tick()
returns void language plpgsql security definer
set search_path to 'pg_catalog','public'
as $function$
declare r public.bwl_round%rowtype; s public.bwl_settings%rowtype;
start_cup integer; order_list integer[]; final_position integer; secret public.bwl_round_secret%rowtype;
pool numeric(16,2); winners numeric(16,2); distributable numeric(16,2);
total_paid numeric(16,2):=0; payout numeric(16,2); house_take numeric(16,2); b record;
begin
  select * into r from public.bwl_round where id=1 for update;
  select * into s from public.bwl_settings where id=1;
  if not found or r.phase_ends_at>clock_timestamp() then return; end if;
  if r.phase='betting' then
    start_cup:=floor(random()*3)::integer+1;
    select array_agg(v order by random()) into order_list from generate_series(1,3) v;
    if order_list=array[1,2,3] then order_list:=array[2,3,1]; end if;
    final_position:=array_position(order_list,start_cup);
    insert into public.bwl_round_secret(round_id,starting_cup,shuffle_order,final_cup)
      values(r.round_id,start_cup,order_list,final_position)
      on conflict(round_id) do update set starting_cup=excluded.starting_cup,
        shuffle_order=excluded.shuffle_order,final_cup=excluded.final_cup,created_at=now();
    update public.bwl_round set phase='preview',
      phase_ends_at=clock_timestamp()+interval '3 seconds',revealed_cup=null where id=1;
    return;
  elsif r.phase='preview' then
    update public.bwl_round set phase='shuffle',
      phase_ends_at=clock_timestamp()+interval '5 seconds' where id=1;
    return;
  elsif r.phase='shuffle' then
    update public.bwl_round set phase='picking',
      phase_ends_at=clock_timestamp()+interval '15 seconds' where id=1;
    return;
  elsif r.phase='picking' then
    select * into secret from public.bwl_round_secret where round_id=r.round_id;
    pool:=coalesce((select sum(stake) from public.bwl_bets where round_id=r.round_id),0);
    winners:=coalesce((select sum(stake) from public.bwl_bets
      where round_id=r.round_id and secret.final_cup=any(guesses)),0);
    distributable:=case when winners>0 then round(pool*(1-s.house_cut_pct/100),2) else 0 end;
    for b in select user_id,stake,(secret.final_cup=any(guesses)) as won
      from public.bwl_bets where round_id=r.round_id order by user_id
    loop
      if b.won then
        payout:=round(distributable*b.stake/winners,2);
        total_paid:=total_paid+payout;
        update public.bwl_profiles set locked=greatest(0,locked-b.stake),
          available=available+payout,
          wins=wins+case when s.leaderboard_on then 1 else 0 end where id=b.user_id;
      else
        update public.bwl_profiles set locked=greatest(0,locked-b.stake) where id=b.user_id;
      end if;
    end loop;
    house_take:=greatest(0,pool-total_paid);
    update public.bwl_house set balance=balance+house_take where id=1;
    insert into public.bwl_results(round_id,winning_cup,total_pool,paid_out,house_cut)
      values(r.round_id,secret.final_cup,pool,total_paid,house_take)
      on conflict(round_id) do nothing;
    update public.bwl_round set phase='reveal',revealed_cup=secret.final_cup,
      phase_ends_at=clock_timestamp()+make_interval(secs=>s.reveal_secs) where id=1;
    return;
  elsif r.phase='reveal' then
    delete from public.bwl_round_secret where round_id=r.round_id;
    update public.bwl_round set round_id=r.round_id+1,phase='betting',
      phase_ends_at=clock_timestamp()+make_interval(secs=>s.betting_secs),
      total_pool=0,bettors=0,revealed_cup=null where id=1;
  end if;
end
$function$;

revoke all on function public.bwl_place_bet(numeric) from public, anon;
revoke all on function public.bwl_guess(integer) from public, anon;
revoke all on function public.bwl_game_state() from public, anon;
grant execute on function public.bwl_place_bet(numeric) to authenticated;
grant execute on function public.bwl_guess(integer) to authenticated;
grant execute on function public.bwl_game_state() to authenticated;
