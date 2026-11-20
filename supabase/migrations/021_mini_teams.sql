begin;
alter table public.teams drop constraint if exists teams_age_class_check;
alter table public.teams add constraint teams_age_class_check check(age_class in ('senior','youth','mini'));
create or replace function public.classify_mini_team() returns trigger
language plpgsql set search_path='' as $$
begin
 if public.keistad_team_key(new.name) ~ '^L[1-6][0-9]+$' then new.age_class:='mini';end if;
 return new;
end;$$;
revoke all on function public.classify_mini_team() from public,anon,authenticated;
drop trigger if exists classify_mini_team on public.teams;
create trigger classify_mini_team before insert or update of name,age_class on public.teams for each row execute function public.classify_mini_team();
update public.teams set age_class='mini' where public.keistad_team_key(name) ~ '^L[1-6][0-9]+$' and age_class<>'mini';
-- Keep the existing youth point norm for reclassified mini teams.
create or replace function public.team_member_points(p_team uuid)
returns table(member_id uuid,first_name text,last_name text,referee_qualification text,captain boolean,norm numeric,earned numeric,planned numeric,to_earn numeric)
language sql stable security definer set search_path='' as $$
 with visible as (
  select m.member_id,m.captain,m.season_id,coalesce(m.norm_override,case when t.age_class in ('youth','mini') then s.youth_norm else s.senior_norm end,s.default_norm,0) as norm
  from public.memberships m join public.teams t on t.id=m.team_id and t.season_id=m.season_id join public.seasons s on s.id=m.season_id and s.active
  where m.team_id=p_team and exists(select 1 from public.memberships mine where mine.member_id=auth.uid() and mine.team_id=m.team_id and mine.season_id=m.season_id)
 ), scores as (
  select v.*,
   coalesce((select sum(a.points) from public.function_assignments a where a.member_id=v.member_id and a.season_id=v.season_id),0)+coalesce((select sum(d.points) from public.enrollments e join public.duties d on d.id=e.duty_id where e.member_id=v.member_id and not e.revoked and d.season_id=v.season_id and not d.cancelled and not d.credit_blocked and d.ends_at<=now()),0) as raw_earned,
   coalesce((select sum(d.points) from public.enrollments e join public.duties d on d.id=e.duty_id where e.member_id=v.member_id and not e.revoked and d.season_id=v.season_id and not d.cancelled and not d.credit_blocked and d.ends_at>now()),0) as planned
  from visible v
 )
 select v.member_id,p.first_name,p.last_name,p.referee_qualification,v.captain,v.norm,least(v.norm,greatest(0,v.raw_earned)),v.planned,greatest(0,v.norm-v.raw_earned)
 from scores v join public.profiles p on p.id=v.member_id order by p.last_name,p.first_name,v.member_id;
$$;
notify pgrst,'reload schema';
commit;
