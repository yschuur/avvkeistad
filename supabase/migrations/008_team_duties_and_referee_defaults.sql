-- Apply after 003, 005 and 006. No existing duty, enrollment or earned points
-- are rewritten. Default points are copied only when a new duty is created.
begin;
create table if not exists public.duty_settings (
 id boolean primary key default true check(id),
 referee_points numeric(8,2) not null default 2
  check(referee_points>0 and referee_points<=1000 and mod(referee_points,0.25)=0),
 updated_at timestamptz not null default now(),
 updated_by uuid references public.profiles(id) on delete set null
);
insert into public.duty_settings(id) values(true) on conflict(id) do nothing;
alter table public.duty_settings enable row level security;
drop policy if exists duty_settings_read on public.duty_settings;
create policy duty_settings_read on public.duty_settings for select to authenticated using(id);
revoke all on public.duty_settings from public,anon,authenticated;
grant select(id,referee_points) on public.duty_settings to authenticated;

create or replace function public.save_duty_settings(p_referee_points numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_referee_points is null or p_referee_points<=0 or p_referee_points>1000 or mod(p_referee_points,0.25)<>0 then
  raise exception 'Kies 0,25 tot 1000 punten, in stappen van 0,25.';
 end if;
 insert into public.duty_settings(id,referee_points,updated_at,updated_by) values(true,p_referee_points,now(),auth.uid())
 on conflict(id) do update set referee_points=excluded.referee_points,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into public.audit_log(actor_id,action,details) values(auth.uid(),'save_duty_settings',jsonb_build_object('referee_points',p_referee_points));
end;$$;
create or replace function public.default_referee_points() returns numeric
language plpgsql stable security definer set search_path='' as $$
declare points numeric;
begin
 select referee_points into points from public.duty_settings where id;
 if points is null then raise exception 'Stel eerst de standaardpunten voor fluitdiensten in.';end if;
 return points;
end;$$;

create or replace function public.create_default_duty(p_season uuid,p_title text,p_kind text,p_start timestamptz,p_end timestamptz,p_location text,p_capacity integer,p_qualification text default null,p_team uuid default null,p_repeat integer default 1) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 perform public.create_qualified_duty(p_season,p_title,p_kind,p_start,p_end,p_location,p_capacity,public.default_referee_points(),p_qualification,p_team,p_repeat);
end;$$;

create or replace function public.assign_duty_team(p_duty uuid,p_team uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 -- Same duty-first locking order as enrollment and cancellation.
 select * into d from public.duties where id=p_duty for update;
 if not found then raise exception 'Dienst niet gevonden.';end if;
 if d.cancelled or d.signup_closed or d.starts_at<=now() then raise exception 'Alleen een openstaande toekomstige dienst kan aan een team worden toegewezen.';end if;
 if p_team is not null and not exists(select 1 from public.teams where id=p_team and season_id=d.season_id) then
  raise exception 'Kies een team uit hetzelfde seizoen als de dienst.';
 end if;
 if d.assigned_team_id is not distinct from p_team then return;end if;
 if p_team is not null and exists(
  select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked
  and not exists(select 1 from public.memberships m where m.member_id=e.member_id and m.season_id=d.season_id and m.team_id=p_team)
 ) then raise exception 'Er zijn al deelnemers buiten dit team ingeschreven. Trek hun inschrijving eerst in of kies hun team.';end if;
 update public.duties set assigned_team_id=p_team where id=d.id;
 insert into public.audit_log(actor_id,action,entity_id,details)
 values(auth.uid(),'assign_duty_team',d.id,jsonb_build_object('previous_team_id',d.assigned_team_id,'team_id',p_team,'match_id',d.match_id));
end;$$;

create or replace function public.create_team_match_duty(p_match uuid,p_team uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare duty uuid;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 -- Retain the existing 90-minute planning window without asking the caller
 -- for a duration. Match status and qualification stay governed by 003/006.
 duty:=public.create_automatic_match_duty(p_match,public.default_referee_points(),90);
 perform public.assign_duty_team(duty,p_team);
 return duty;
end;$$;
revoke all on function public.default_referee_points() from public,anon,authenticated;
revoke all on function public.save_duty_settings(numeric),public.create_default_duty(uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer),public.assign_duty_team(uuid,uuid),public.create_team_match_duty(uuid,uuid) from public,anon;
grant execute on function public.save_duty_settings(numeric),public.create_default_duty(uuid,text,text,timestamptz,timestamptz,text,integer,text,uuid,integer),public.assign_duty_team(uuid,uuid),public.create_team_match_duty(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
