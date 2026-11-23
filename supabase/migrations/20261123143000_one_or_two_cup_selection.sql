-- Add atomic one-cup or two-cup selection for the redesigned player interface.
create or replace function public.bwl_submit_guesses(p_cups integer[])
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth'
as $function$
declare
  r public.bwl_round%rowtype;
  b public.bwl_bets%rowtype;
  chosen integer[];
  target_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_cups is null or cardinality(p_cups) not between 1 and 2 then
    raise exception 'Choose one cup or two cups';
  end if;
  if exists(select 1 from unnest(p_cups) v where v is null or v not between 1 and 3)
     or cardinality(array(select distinct v from unnest(p_cups) v))<>cardinality(p_cups) then
    raise exception 'Choose different cups from 1 to 3';
  end if;
  chosen:=p_cups;
  select * into r from public.bwl_round where id=1 for update;
  if r.phase<>'picking' or r.phase_ends_at<=clock_timestamp() then
    raise exception 'The selection period is closed';
  end if;
  select * into b from public.bwl_bets
    where round_id=r.round_id and user_id=auth.uid() for update;
  if not found then raise exception 'Place a stake before the shuffle to play'; end if;
  if cardinality(coalesce(b.guesses,'{}'::integer[]))>0 then
    raise exception 'Your cup selection has already been submitted';
  end if;
  update public.bwl_bets set guesses=chosen where id=b.id;
  select count(*) into target_count from unnest(chosen) v
    where v=(select final_cup from public.bwl_round_secret where round_id=r.round_id);
  return jsonb_build_object('guesses',chosen,'correct',target_count>0,
    'attempts_used',cardinality(chosen),'attempts_left',2-cardinality(chosen));
end
$function$;
revoke all on function public.bwl_submit_guesses(integer[]) from public,anon;
grant execute on function public.bwl_submit_guesses(integer[]) to authenticated;