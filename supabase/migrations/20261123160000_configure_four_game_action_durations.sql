-- Configure each of the four cup-game actions independently.
alter table public.bwl_settings
  add column if not exists preview_secs integer not null default 3,
  add column if not exists shuffle_secs integer not null default 3,
  add column if not exists picking_secs integer not null default 5;
alter table public.bwl_settings drop constraint if exists bwl_settings_reveal_secs_check;
alter table public.bwl_settings add constraint bwl_settings_reveal_secs_check check (reveal_secs between 1 and 120);
update public.bwl_settings set preview_secs=3,shuffle_secs=3,picking_secs=5,reveal_secs=2 where id=1;

create or replace function public.bwl_tick()
returns void language plpgsql security definer set search_path to 'pg_catalog','public'
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
   on conflict(round_id) do update set starting_cup=excluded.starting_cup,shuffle_order=excluded.shuffle_order,
   final_cup=excluded.final_cup,created_at=now();
  update public.bwl_round set phase='preview',phase_ends_at=clock_timestamp()+make_interval(secs=>s.preview_secs),revealed_cup=null where id=1;
  return;
 elsif r.phase='preview' then
  update public.bwl_round set phase='shuffle',phase_ends_at=clock_timestamp()+make_interval(secs=>s.shuffle_secs) where id=1;
  return;
 elsif r.phase='shuffle' then
  update public.bwl_round set phase='picking',phase_ends_at=clock_timestamp()+make_interval(secs=>s.picking_secs) where id=1;
  return;
 elsif r.phase='picking' then
  select * into secret from public.bwl_round_secret where round_id=r.round_id;
  pool:=coalesce((select sum(stake) from public.bwl_bets where round_id=r.round_id),0);
  winners:=coalesce((select sum(stake) from public.bwl_bets where round_id=r.round_id and secret.final_cup=any(guesses)),0);
  distributable:=case when winners>0 then round(pool*(1-s.house_cut_pct/100),2) else 0 end;
  for b in select user_id,stake,(secret.final_cup=any(guesses)) as won from public.bwl_bets where round_id=r.round_id order by user_id loop
   if b.won then
    payout:=round(distributable*b.stake/winners,2); total_paid:=total_paid+payout;
    update public.bwl_profiles set locked=greatest(0,locked-b.stake),available=available+payout,
      wins=wins+case when s.leaderboard_on then 1 else 0 end where id=b.user_id;
   else update public.bwl_profiles set locked=greatest(0,locked-b.stake) where id=b.user_id;
   end if;
  end loop;
  house_take:=greatest(0,pool-total_paid);
  update public.bwl_house set balance=balance+house_take where id=1;
  insert into public.bwl_results(round_id,winning_cup,total_pool,paid_out,house_cut)
   values(r.round_id,secret.final_cup,pool,total_paid,house_take) on conflict(round_id) do nothing;
  update public.bwl_round set phase='reveal',revealed_cup=secret.final_cup,
   phase_ends_at=clock_timestamp()+make_interval(secs=>s.reveal_secs) where id=1;
  return;
 elsif r.phase='reveal' then
  delete from public.bwl_round_secret where round_id=r.round_id;
  update public.bwl_round set round_id=r.round_id+1,phase='betting',
   phase_ends_at=clock_timestamp()+make_interval(secs=>s.betting_secs),total_pool=0,bettors=0,revealed_cup=null where id=1;
 end if;
end
$function$;

drop function public.bwl_admin_save_settings(integer,integer,numeric,numeric,boolean);
create function public.bwl_admin_save_settings(p_betting integer,p_preview integer,p_shuffle integer,p_picking integer,p_reveal integer,p_min numeric,p_cut numeric,p_lb boolean)
returns void language plpgsql security definer set search_path to 'pg_catalog','public','auth','bwl_private'
as $function$
begin
 if not public.bwl_is_admin() then raise exception 'Administrator access required'; end if;
 if p_betting not between 10 and 600 or p_preview not between 1 and 120 or p_shuffle not between 1 and 120
  or p_picking not between 1 and 120 or p_reveal not between 1 and 120 or p_min is null or p_min<=0
  or p_cut is null or p_cut not between 0 and 50 or p_lb is null then raise exception 'Invalid settings'; end if;
 update public.bwl_settings set betting_secs=p_betting,preview_secs=p_preview,shuffle_secs=p_shuffle,
  picking_secs=p_picking,reveal_secs=p_reveal,min_stake=round(p_min,2),house_cut_pct=p_cut,leaderboard_on=p_lb where id=1;
end
$function$;
revoke all on function public.bwl_admin_save_settings(integer,integer,integer,integer,integer,numeric,numeric,boolean) from public,anon;
grant execute on function public.bwl_admin_save_settings(integer,integer,integer,integer,integer,numeric,numeric,boolean) to authenticated;
