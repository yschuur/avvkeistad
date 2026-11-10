begin;
create or replace function public.captain_team_duty_count() returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.duties d
 join public.seasons s on s.id=d.season_id and s.active
 where auth.uid() is not null and not d.cancelled and not d.signup_closed and d.starts_at>now()
 and exists(select 1 from public.memberships m where m.member_id=auth.uid() and m.captain and m.team_id=d.assigned_team_id and m.season_id=d.season_id)
 and (select count(*) from public.enrollments e where e.duty_id=d.id and not e.revoked)<d.capacity;
$$;
revoke all on function public.captain_team_duty_count() from public,anon;
grant execute on function public.captain_team_duty_count() to authenticated;
notify pgrst,'reload schema';
commit;
