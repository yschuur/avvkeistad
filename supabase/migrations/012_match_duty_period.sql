-- Apply after 008 (and 010 for the current division requirements).
begin;
create or replace function public.create_match_duties_for_period(p_season uuid,p_from date,p_until date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.matches;created integer:=0;existing integer:=0;excluded integer:=0;unknown integer:=0;unavailable integer:=0;needs_ref boolean;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_from is null or p_until is null or p_until<p_from then raise exception 'Kies een geldige periode; de einddatum moet op of na de begindatum liggen.';end if;
 perform 1 from public.seasons where id=p_season and active for share;
 if not found then raise exception 'Kies het actieve seizoen.';end if;
 -- Lock in a stable order; a simultaneous run rechecks existing duties after waiting.
 for m in select * from public.matches
  where season_id=p_season and public.keistad_team_key(home_team) is not null
   and starts_at >= (p_from::timestamp at time zone 'Europe/Amsterdam')
   and starts_at < ((p_until+1)::timestamp at time zone 'Europe/Amsterdam')
  order by id for update
 loop
  if m.cancelled or m.status<>'scheduled' or m.starts_at<=now() then unavailable:=unavailable+1;continue;end if;
  needs_ref:=public.match_needs_club_referee(m.id);
  if needs_ref is null then unknown:=unknown+1;continue;end if;
  if not needs_ref then excluded:=excluded+1;continue;end if;
  -- A cancelled duty also records a deliberate decision; bulk creation preserves it.
  if exists(select 1 from public.duties where match_id=m.id and kind='referee') then existing:=existing+1;continue;end if;
  perform public.create_team_match_duty(m.id,null);
  created:=created+1;
 end loop;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'create_match_duties_for_period',p_season,jsonb_build_object('from',p_from,'until',p_until,'created',created,'existing',existing,'excluded',excluded,'unknown',unknown,'unavailable',unavailable));
 return jsonb_build_object('created',created,'existing',existing,'excluded',excluded,'unknown',unknown,'unavailable',unavailable);
end;$$;
revoke all on function public.create_match_duties_for_period(uuid,date,date) from public,anon;
grant execute on function public.create_match_duties_for_period(uuid,date,date) to authenticated;
notify pgrst,'reload schema';
commit;
