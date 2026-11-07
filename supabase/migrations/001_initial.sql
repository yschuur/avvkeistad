-- AVV Keistad: execute once in the Supabase SQL editor, or use supabase db push.
begin;
create type public.app_role as enum ('admin','manager','member');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 first_name text not null, last_name text not null, email text not null,
 role public.app_role not null default 'member', nevobo_code text unique,
 referee_level integer not null default 0 check (referee_level between 0 and 10)
);
create table public.seasons (
 id uuid primary key default gen_random_uuid(), name text not null,
 starts_on date not null, ends_on date not null, active boolean not null default false,
 default_norm numeric(8,2) not null check(default_norm>=0),
 youth_norm numeric(8,2) check(youth_norm>=0), senior_norm numeric(8,2) check(senior_norm>=0),
 check(ends_on>=starts_on)
);
create unique index one_active_season on public.seasons(active) where active;
create table public.teams (
 id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons(id),
 name text not null, age_class text not null check(age_class in ('youth','senior')),
 unique(season_id,name), unique(id,season_id)
);
create table public.memberships (
 member_id uuid not null references public.profiles(id), season_id uuid not null references public.seasons(id),
 team_id uuid not null, captain boolean not null default false, norm_override numeric(8,2) check(norm_override>=0),
 primary key(member_id,season_id), foreign key(team_id,season_id) references public.teams(id,season_id)
);
create table public.matches (
 id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons(id),
 external_id text unique, home_team text not null, away_team text not null, starts_at timestamptz not null,
 location text not null, level text not null, club_referee boolean not null default false,
 cancelled boolean not null default false, synced_at timestamptz
);
create table public.duties (
 id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons(id),
 title text not null check(length(title) between 1 and 200),
 kind text not null check(kind in ('bar','referee','event','lines')),
 starts_at timestamptz not null, ends_at timestamptz not null, location text not null,
 points numeric(8,2) not null check(points>0), capacity integer not null check(capacity between 1 and 100),
 required_level integer not null default 0 check(required_level between 0 and 10),
 assigned_team_id uuid, match_id uuid references public.matches(id), series_id uuid,
 cancelled boolean not null default false, check(ends_at>starts_at),
 foreign key(assigned_team_id,season_id) references public.teams(id,season_id)
);
create index duties_season_date on public.duties(season_id,starts_at);
create table public.enrollments (
 id uuid primary key default gen_random_uuid(), duty_id uuid not null references public.duties(id),
 member_id uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 offered boolean not null default false, revoked boolean not null default false,
 revoked_reason text, revoked_at timestamptz
);
create unique index one_active_enrollment on public.enrollments(duty_id,member_id) where not revoked;
create index enrollment_member on public.enrollments(member_id);
create table public.function_definitions (
 id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons(id),
 title text not null, points numeric(8,2) not null check(points>=0), unique(season_id,title)
);
create table public.function_assignments (
 id uuid primary key default gen_random_uuid(), season_id uuid not null references public.seasons(id),
 member_id uuid not null references public.profiles(id), title text not null,
 points numeric(8,2) not null check(points>=0), starts_on date not null, ends_on date not null,
 check(ends_on>=starts_on)
);
create table public.audit_log (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles(id),
 action text not null, entity_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create function public.is_manager() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role in ('admin','manager'));
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;
create function public.captains(p_member uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.memberships mine join public.memberships theirs
 on mine.team_id=theirs.team_id and mine.season_id=theirs.season_id
 join public.seasons s on s.id=mine.season_id and s.active
 where mine.member_id=auth.uid() and mine.captain and theirs.member_id=p_member);
$$;
create function public.may_view_member(p_member uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid()=p_member or public.is_manager() or public.captains(p_member);
$$;
-- All application writes use the limited operations below. No anonymous access.
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (public.may_view_member(id));
alter table public.seasons enable row level security;
create policy seasons_read on public.seasons for select to authenticated using (true);
alter table public.teams enable row level security;
create policy teams_read on public.teams for select to authenticated using (true);
alter table public.memberships enable row level security;
create policy memberships_read on public.memberships for select to authenticated using(public.may_view_member(member_id));
alter table public.matches enable row level security;
create policy matches_read on public.matches for select to authenticated using(true);
alter table public.duties enable row level security;
create policy duties_read on public.duties for select to authenticated using(true);
alter table public.enrollments enable row level security;
create policy enrollments_read on public.enrollments for select to authenticated using(public.may_view_member(member_id));
alter table public.function_definitions enable row level security;
create policy function_definitions_read on public.function_definitions for select to authenticated using(true);
alter table public.function_assignments enable row level security;
create policy assignments_read on public.function_assignments for select to authenticated using(public.may_view_member(member_id));
alter table public.audit_log enable row level security;
create policy audit_read on public.audit_log for select to authenticated using(public.is_manager());
-- Only counts and takeover IDs are exposed, never other members' personal details.
create function public.duty_availability() returns table(duty_id uuid, occupied bigint, offered_ids uuid[])
language sql stable security definer set search_path='' as $$
 select d.id,count(e.id),coalesce(array_agg(e.id) filter(where e.offered),'{}'::uuid[])
 from public.duties d left join public.enrollments e on e.duty_id=d.id and not e.revoked
 where auth.uid() is not null group by d.id;
$$;
create function public.enroll(p_duty uuid,p_member uuid default null,p_takeover uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties; target uuid:=coalesce(p_member,auth.uid()); old public.enrollments; current_count integer;
begin
 if auth.uid() is null then raise exception 'Log eerst in.'; end if;
 select * into d from public.duties where id=p_duty for update;
 if not found or d.cancelled or d.starts_at<=now() then raise exception 'Deze dienst is niet meer beschikbaar.'; end if;
 -- Serialize simultaneous signups for the same member, including different duties.
 perform 1 from public.profiles where id=target for update;
 if target<>auth.uid() and not public.is_manager() then
   if not exists(select 1 from public.memberships m join public.memberships c on c.team_id=m.team_id and c.season_id=m.season_id
    where m.member_id=target and c.member_id=auth.uid() and c.captain and m.team_id=d.assigned_team_id and m.season_id=d.season_id)
   then raise exception 'Je mag deze deelnemer niet toewijzen.'; end if;
 end if;
 if not exists(select 1 from public.memberships where member_id=target and season_id=d.season_id)
 then raise exception 'Een teamindeling voor dit seizoen is verplicht.'; end if;
 if d.assigned_team_id is not null and not exists(select 1 from public.memberships where member_id=target and season_id=d.season_id and team_id=d.assigned_team_id)
 then raise exception 'Deze dienst is voor een ander team gereserveerd.'; end if;
 if not exists(select 1 from public.profiles where id=target and referee_level>=d.required_level)
 then raise exception 'De scheidsrechtersbevoegdheid is onvoldoende.'; end if;
 if exists(select 1 from public.enrollments e join public.duties other on other.id=e.duty_id
 where e.member_id=target and not e.revoked and not other.cancelled and other.starts_at<d.ends_at and other.ends_at>d.starts_at)
 then raise exception 'Deze dienst overlapt met een bestaande inschrijving.'; end if;
 if p_takeover is not null then
  select * into old from public.enrollments where id=p_takeover and duty_id=d.id and offered and not revoked for update;
  if not found or old.member_id=target then raise exception 'Deze dienst kan niet meer worden overgenomen.'; end if;
  update public.enrollments set revoked=true,revoked_at=now(),revoked_reason='Overgenomen',offered=false where id=old.id;
 else
  select count(*) into current_count from public.enrollments where duty_id=d.id and not revoked;
  if current_count>=d.capacity then raise exception 'Deze dienst is vol.'; end if;
 end if;
 insert into public.enrollments(duty_id,member_id) values(d.id,target);
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'enroll',d.id,jsonb_build_object('member_id',target,'takeover',p_takeover));
end;
$$;
create function public.change_enrollment(p_enrollment uuid,p_action text,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare e public.enrollments; d public.duties; duty_uuid uuid;
begin
 -- Same lock order as enroll: duty, then enrollment.
 select duty_id into duty_uuid from public.enrollments where id=p_enrollment;
 select * into d from public.duties where id=duty_uuid for update;
 select * into e from public.enrollments where id=p_enrollment and not revoked for update;
 if not found or auth.uid() is null then raise exception 'Inschrijving niet gevonden.'; end if;
 if p_action='revoke' then
  if not public.is_manager() or length(trim(coalesce(p_reason,'')))<3 then raise exception 'Beheerrechten en een reden zijn verplicht.'; end if;
  update public.enrollments set revoked=true,offered=false,revoked_at=now(),revoked_reason=p_reason where id=e.id;
 else
  if e.member_id<>auth.uid() then raise exception 'Dit is niet jouw inschrijving.'; end if;
  if d.starts_at<=now() or d.cancelled then raise exception 'Deze dienst is al begonnen of geannuleerd.'; end if;
  if p_action='withdraw' then
   if now()>=e.created_at+interval '24 hours' then raise exception 'De afmeldtermijn van 24 uur is voorbij. Bied de dienst ter overname aan.'; end if;
   update public.enrollments set revoked=true,offered=false,revoked_at=now(),revoked_reason='Afgemeld binnen 24 uur' where id=e.id;
  elsif p_action in ('offer','unoffer') then
   update public.enrollments set offered=(p_action='offer') where id=e.id;
  else raise exception 'Ongeldige actie.';
  end if;
 end if;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),p_action,e.id,jsonb_build_object('reason',p_reason));
end;
$$;
create function public.create_duty(p_season uuid,p_title text,p_kind text,p_start timestamptz,p_end timestamptz,p_location text,p_capacity integer,p_points numeric,p_level integer default 0,p_team uuid default null,p_repeat integer default 1) returns void
language plpgsql security definer set search_path='' as $$
declare i integer; s public.seasons; start_local timestamp; end_local timestamp; generated_start timestamptz; generated_end timestamptz; series uuid:=gen_random_uuid();
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 if p_repeat not between 1 and 53 then raise exception 'Kies 1 tot 53 herhalingen.'; end if;
 select * into s from public.seasons where id=p_season;
 if not found then raise exception 'Seizoen niet gevonden.'; end if;
 start_local:=p_start at time zone 'Europe/Amsterdam'; end_local:=p_end at time zone 'Europe/Amsterdam';
 for i in 0..p_repeat-1 loop
  generated_start:=(start_local+make_interval(days=>i*7)) at time zone 'Europe/Amsterdam';
  generated_end:=(end_local+make_interval(days=>i*7)) at time zone 'Europe/Amsterdam';
  if generated_start::date<s.starts_on or generated_end::date>s.ends_on then raise exception 'De reeks valt buiten het seizoen.'; end if;
  insert into public.duties(season_id,title,kind,starts_at,ends_at,location,capacity,points,required_level,assigned_team_id,series_id)
   values(p_season,p_title,p_kind,generated_start,generated_end,p_location,p_capacity,
    case when p_kind='referee' then p_points else extract(epoch from (generated_end-generated_start))/3600 end,p_level,p_team,case when p_repeat>1 then series else null end);
 end loop;
 insert into public.audit_log(actor_id,action,details) values(auth.uid(),'create_duty',jsonb_build_object('title',p_title,'count',p_repeat));
end;
$$;
create function public.setup_season(p_name text,p_start date,p_end date,p_norm numeric,p_youth numeric,p_senior numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 if exists(select 1 from public.seasons where active) then
  update public.seasons set default_norm=p_norm,youth_norm=p_youth,senior_norm=p_senior where active;
 else
  insert into public.seasons(name,starts_on,ends_on,default_norm,youth_norm,senior_norm,active) values(p_name,p_start,p_end,p_norm,p_youth,p_senior,true);
 end if;
end;
$$;
create function public.create_team(p_season uuid,p_name text,p_age text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 insert into public.teams(season_id,name,age_class) values(p_season,p_name,p_age);
end;
$$;
create function public.update_member(p_member uuid,p_season uuid,p_team uuid,p_captain boolean,p_norm numeric,p_level integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 update public.profiles set referee_level=p_level where id=p_member;
 insert into public.memberships(member_id,season_id,team_id,captain,norm_override) values(p_member,p_season,p_team,p_captain,p_norm)
 on conflict(member_id,season_id) do update set team_id=excluded.team_id,captain=excluded.captain,norm_override=excluded.norm_override;
 insert into public.audit_log(actor_id,action,entity_id) values(auth.uid(),'update_member',p_member);
end;
$$;
create function public.assign_function(p_member uuid,p_season uuid,p_title text,p_points numeric,p_start date,p_end date) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 if not exists(select 1 from public.memberships where member_id=p_member and season_id=p_season) then raise exception 'Dit lid heeft geen team in het seizoen.'; end if;
 insert into public.function_assignments(member_id,season_id,title,points,starts_on,ends_on) values(p_member,p_season,p_title,p_points,p_start,p_end);
 insert into public.audit_log(actor_id,action,entity_id) values(auth.uid(),'assign_function',p_member);
end;
$$;
create function public.cancel_duty(p_duty uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 update public.duties set cancelled=true where id=p_duty;
 if not found then raise exception 'Dienst niet gevonden.'; end if;
 insert into public.audit_log(actor_id,action,entity_id) values(auth.uid(),'cancel_duty',p_duty);
end;
$$;
create function public.save_function(p_season uuid,p_title text,p_points numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 insert into public.function_definitions(season_id,title,points) values(p_season,p_title,p_points)
 on conflict(season_id,title) do update set points=excluded.points;
end;
$$;
create function public.remove_function(p_assignment uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 delete from public.function_assignments where id=p_assignment;
 insert into public.audit_log(actor_id,action,entity_id) values(auth.uid(),'remove_function',p_assignment);
end;
$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,first_name,last_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'first_name',''),coalesce(new.raw_user_meta_data->>'last_name',''),coalesce(new.email,''));
 return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Supabase may grant default privileges: explicitly restrict the app surface.
revoke all on all tables in schema public from anon,authenticated;
grant select on all tables in schema public to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user() from authenticated;
commit;
