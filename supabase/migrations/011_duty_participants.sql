-- Authenticated members may see names on upcoming duties of the active season.
-- No broader access to profiles, email addresses or enrollment history.
begin;
create or replace function public.duty_participants()
returns table(duty_id uuid,first_name text,last_name text)
language sql stable security definer set search_path='' as $$
 select d.id,p.first_name,p.last_name
 from public.duties d
 join public.seasons s on s.id=d.season_id and s.active
 join public.enrollments e on e.duty_id=d.id and not e.revoked
 join public.profiles p on p.id=e.member_id
 where auth.uid() is not null and not d.cancelled and d.starts_at>now();
$$;
revoke all on function public.duty_participants() from public,anon;
grant execute on function public.duty_participants() to authenticated;
notify pgrst,'reload schema';
commit;
