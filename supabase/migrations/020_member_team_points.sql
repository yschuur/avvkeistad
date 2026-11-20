-- Team mates may read names and point totals, never each other's private records.
begin;
create or replace function public.team_member_points(p_team uuid)
returns table(member_id uuid,first_name text,last_name text,referee_qualification text,captain boolean,norm numeric,earned numeric,planned numeric,to_earn numeric)
language sql stable security definer set search_path='' as $$
 with visible as (
  select m.member_id,m.captain,m.season_id,coalesce(m.norm_override,case when t.age_class='youth' then s.youth_norm else s.senior_norm end,s.default_norm,0) as norm
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
revoke all on function public.team_member_points(uuid) from public,anon;
grant execute on function public.team_member_points(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
