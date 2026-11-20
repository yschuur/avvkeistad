-- Scope expensive availability and participant reads to the requested duties.
-- No new identity fields or write permissions are exposed.
begin;
create index if not exists enrollment_active_slot on public.enrollments(duty_id,slot_number) where not revoked;
create or replace function public.duty_availability_for(p_season uuid,p_duties uuid[],p_slots boolean default true)
returns table(duty_id uuid,occupied bigint,offered_ids uuid[],slots jsonb)
language sql stable security definer set search_path='' as $$
 select d.id,(select count(*) from public.enrollments e where e.duty_id=d.id and not e.revoked),
 coalesce((select array_agg(e.id) from public.enrollments e where e.duty_id=d.id and not e.revoked and e.offered),'{}'::uuid[]),
 case when p_slots then (select jsonb_agg(jsonb_build_object('slot',i,'team_id',(public.duty_slot_teams(d))[i],'occupied',exists(select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked and e.slot_number=i),'offered_id',(select e.id from public.enrollments e where e.duty_id=d.id and not e.revoked and e.offered and e.slot_number=i)) order by i) from generate_series(1,d.capacity) i) else null end
 from public.duties d where auth.uid() is not null and d.season_id=p_season and d.id=any(p_duties);
$$;
-- Existing dashboards keep the same result shape, within their active season.
create or replace function public.duty_availability()
returns table(duty_id uuid,occupied bigint,offered_ids uuid[],slots jsonb)
language sql stable security definer set search_path='' as $$
 select a.* from public.seasons s cross join lateral public.duty_availability_for(s.id,array(select d.id from public.duties d where d.season_id=s.id),true) a where s.active;
$$;
create or replace function public.duty_participants_for(p_duties uuid[])
returns table(duty_id uuid,first_name text,last_name text)
language sql stable security definer set search_path='' as $$
 select d.id,p.first_name,p.last_name from public.duties d
 join public.seasons s on s.id=d.season_id and s.active
 join public.enrollments e on e.duty_id=d.id and not e.revoked
 join public.profiles p on p.id=e.member_id
 where auth.uid() is not null and not d.cancelled and d.starts_at>now() and d.id=any(p_duties);
$$;
revoke all on function public.duty_availability_for(uuid,uuid[],boolean),public.duty_participants_for(uuid[]) from public,anon;
grant execute on function public.duty_availability_for(uuid,uuid[],boolean),public.duty_participants_for(uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
