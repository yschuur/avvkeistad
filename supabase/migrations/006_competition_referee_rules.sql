-- Apply after 003 and 005. Import the supplied team list separately with
-- supabase/import_keistad_teams.sql; this migration does not delete teams.
begin;
alter table public.teams add column if not exists competition_level text
 check(competition_level in ('Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie','Promotieklasse','Hoofdklasse','Eerste klasse','Tweede klasse','Derde klasse','Vierde klasse','Overig'));

create or replace function public.keistad_team_key(p_name text) returns text
language plpgsql immutable set search_path='' as $$
declare parts text[];
begin
 parts:=regexp_match(trim(p_name),'\mkeistad\s+(HS|DS|JA|JB|JC|MA|MB|MC|XZ|L[1-6])\s*([0-9]+)$','i');
 if parts is null then parts:=regexp_match(trim(p_name),'^(HS|DS|JA|JB|JC|MA|MB|MC|XZ|L[1-6])\s*([0-9]+)$','i');end if;
 if parts is not null then return upper(parts[1])||(parts[2]::integer)::text;end if;
 parts:=regexp_match(trim(p_name),'^(Heren|Dames|H|D)\s*([0-9]+)$','i');
 if parts is not null then return case when lower(parts[1]) in ('heren','h') then 'HS' else 'DS' end||(parts[2]::integer)::text;end if;
 return null;
end;
$$;
create index if not exists teams_keistad_identity on public.teams(season_id,public.keistad_team_key(name));
create or replace function public.team_referee_requirement(p_age text,p_competition text) returns text
language sql immutable set search_path='' as $$
 select case when p_competition in ('Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie') then 'R1'
 when p_competition='Promotieklasse' then 'R2'
 when (p_age='senior' and p_competition in ('Eerste klasse','Tweede klasse')) or (p_age='youth' and p_competition='Hoofdklasse') then 'V4'
 else 'V6' end;
$$;
create or replace function public.match_referee_requirement(p_match uuid) returns text
language plpgsql stable security definer set search_path='' as $$
declare m public.matches;club_name text;identity text;team public.teams;n integer;required text:='V6';code text;found_club boolean:=false;
begin
 select * into m from public.matches where id=p_match;
 if not found then return null;end if;
 foreach club_name in array array[m.home_team,m.away_team] loop
  if club_name !~* '\mkeistad\M' then continue;end if;
  found_club:=true;identity:=public.keistad_team_key(club_name);
  if identity is null then return null;end if;
  select count(*) into n from public.teams where season_id=m.season_id and public.keistad_team_key(name)=identity;
  -- An unrecognized or ambiguous team is never treated as a low-level game.
  if n<>1 then return null;end if;
  select * into team from public.teams where season_id=m.season_id and public.keistad_team_key(name)=identity;
  code:=public.team_referee_requirement(team.age_class,team.competition_level);
  if public.referee_qualification_rank(code)>public.referee_qualification_rank(required) then required:=code;end if;
 end loop;
 return case when found_club then required else null end;
end;
$$;

-- NULL is unrecognized, FALSE explicitly means no club referee is needed.
create or replace function public.match_needs_club_referee(p_match uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.referee_qualification_rank(public.match_referee_requirement(p_match))<public.referee_qualification_rank('R2');
$$;

-- Keep stored levels consistent, including legacy RPCs attempting a lower code.
create or replace function public.derive_match_duty_requirement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.kind='referee' and new.match_id is not null and new.starts_at>now() then
  new.required_qualification:=public.match_referee_requirement(new.match_id);
  new.required_level:=coalesce(public.referee_qualification_rank(new.required_qualification),0);
  if public.match_needs_club_referee(new.match_id)=false then
   if tg_op='INSERT' then raise exception 'Vanaf promotieklasse is geen clubscheidsrechter nodig.';end if;
   new.cancelled:=true;new.signup_closed:=true;new.nevobo_cancelled:=false;
  end if;
 end if;
 return new;
end;
$$;
drop trigger if exists derive_match_duty_requirement on public.duties;
create trigger derive_match_duty_requirement before insert or update of match_id,kind,starts_at,required_level,required_qualification on public.duties for each row execute function public.derive_match_duty_requirement();

create or replace function public.guard_referee_qualification() returns trigger
language plpgsql security definer set search_path='' as $$
declare duty public.duties;qualification text;required text;
begin
 if new.revoked then return new;end if;
 if tg_op='UPDATE' and not(old.revoked or old.member_id is distinct from new.member_id or old.duty_id is distinct from new.duty_id) then return new;end if;
 select * into duty from public.duties where id=new.duty_id for update;
 if duty.kind<>'referee' then return new;end if;
 if duty.match_id is not null and public.match_needs_club_referee(duty.match_id)=false then raise exception 'Vanaf promotieklasse is geen clubscheidsrechter nodig.';end if;
 required:=case when duty.match_id is not null then public.match_referee_requirement(duty.match_id) else duty.required_qualification end;
 if required is null then raise exception 'Het team of vereiste scheidsrechtersniveau is nog niet ingesteld.';end if;
 select referee_qualification into qualification from public.profiles where id=new.member_id for update;
 if qualification is null then raise exception 'Het scheidsrechtersniveau van dit lid is nog niet ingesteld.';end if;
 if public.referee_qualification_rank(qualification)<public.referee_qualification_rank(required) then raise exception 'De scheidsrechtersbevoegdheid is onvoldoende. Minimaal % vereist.',required;end if;
 return new;
end;
$$;

-- Revoke only future responsibilities that no longer meet the actual minimum.
-- Preserve rows and past points; notify the affected member and keep an audit.
create or replace function public.recheck_future_referees(p_duty uuid default null,p_member uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;e record;required text;reason text;not_needed boolean;
begin
 for d in select td.* from public.duties td where td.kind='referee' and td.starts_at>now() and (not td.cancelled or (td.match_id is not null and public.match_needs_club_referee(td.match_id)=false)) and (p_duty is null or td.id=p_duty)
  and exists(select 1 from public.enrollments en where en.duty_id=td.id and not en.revoked and (p_member is null or en.member_id=p_member)) order by td.id for update loop
  not_needed:=coalesce(d.match_id is not null and public.match_needs_club_referee(d.match_id)=false,false);
  required:=case when d.match_id is not null then public.match_referee_requirement(d.match_id) else d.required_qualification end;
  for e in select en.id,en.member_id,p.referee_qualification from public.enrollments en join public.profiles p on p.id=en.member_id where en.duty_id=d.id and not en.revoked and (p_member is null or en.member_id=p_member) for update of en loop
   if not not_needed and required is not null and e.referee_qualification is not null and public.referee_qualification_rank(e.referee_qualification)>=public.referee_qualification_rank(required) then continue;end if;
   reason:=case when not_needed then 'Vanaf promotieklasse is geen clubscheidsrechter nodig; deze clubfluitdienst vervalt.' when required is null then 'Teamniveau ontbreekt; fluitbevoegdheid kan niet worden vastgesteld.' else 'Scheidsrechtersniveau onvoldoende of niet ingesteld; minimaal '||required||' vereist.' end;
   update public.enrollments set revoked=true,revoked_at=now(),revoked_reason=reason,offered=false where id=e.id;
   insert into public.notifications(member_id,match_id,title,body) values(e.member_id,d.match_id,case when not_needed then 'Clubfluitdienst vervallen' else 'Fluitdienst opnieuw beschikbaar' end,d.title||E'\nJe toewijzing is ingetrokken: '||reason||' Neem bij vragen contact op met de beheerder.');
   insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),case when not_needed then 'club_referee_not_needed' else 'referee_requirement_revoke' end,e.id,jsonb_build_object('duty_id',d.id,'member_id',e.member_id,'required',required,'qualification',e.referee_qualification,'reason',reason));
  end loop;
 end loop;
end;
$$;
create or replace function public.recheck_changed_duty_referees() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.required_qualification is distinct from new.required_qualification or old.match_id is distinct from new.match_id or old.starts_at is distinct from new.starts_at or old.cancelled is distinct from new.cancelled then perform public.recheck_future_referees(new.id);end if;
 return new;
end;
$$;
drop trigger if exists recheck_changed_duty_referees on public.duties;
create trigger recheck_changed_duty_referees after update of required_qualification,match_id,starts_at,cancelled on public.duties for each row execute function public.recheck_changed_duty_referees();
create or replace function public.recheck_changed_member_referees() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.referee_qualification is distinct from new.referee_qualification then perform public.recheck_future_referees(null,new.id);end if;
 return new;
end;
$$;
drop trigger if exists recheck_changed_member_referees on public.profiles;
create trigger recheck_changed_member_referees after update of referee_qualification on public.profiles for each row execute function public.recheck_changed_member_referees();

create or replace function public.refresh_match_referee_requirements(p_season uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.matches set club_referee=coalesce(public.match_needs_club_referee(id),false) where season_id=p_season;
 update public.duties set required_qualification=required_qualification where season_id=p_season and kind='referee' and match_id is not null and starts_at>now();
 -- Also catches unchanged NULL requirements, e.g. an unrecognized legacy team.
 perform public.recheck_future_referees(d.id) from public.duties d where d.season_id=p_season and d.kind='referee' and d.match_id is not null and d.starts_at>now();
end;
$$;
create or replace function public.refresh_changed_team_requirements() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' then perform public.refresh_match_referee_requirements(old.season_id);return old;end if;
 perform public.refresh_match_referee_requirements(new.season_id);
 if tg_op='UPDATE' and old.season_id<>new.season_id then perform public.refresh_match_referee_requirements(old.season_id);end if;
 return new;
end;
$$;
drop trigger if exists refresh_changed_team_requirements on public.teams;
create trigger refresh_changed_team_requirements after insert or delete or update of name,age_class,competition_level,season_id on public.teams for each row execute function public.refresh_changed_team_requirements();
create or replace function public.refresh_changed_match_requirements() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.matches set club_referee=coalesce(public.match_needs_club_referee(new.id),false) where id=new.id;
 if tg_op='UPDATE' and (old.home_team is distinct from new.home_team or old.away_team is distinct from new.away_team or old.season_id is distinct from new.season_id) then
  update public.duties set required_qualification=required_qualification where match_id=new.id and kind='referee' and starts_at>now();
 end if;
 return new;
end;
$$;
drop trigger if exists refresh_changed_match_requirements on public.matches;
create trigger refresh_changed_match_requirements after insert or update of home_team,away_team,season_id on public.matches for each row execute function public.refresh_changed_match_requirements();

create or replace function public.create_automatic_match_duty(p_match uuid,p_points numeric,p_minutes integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare code text;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 code:=public.match_referee_requirement(p_match);
 if public.match_needs_club_referee(p_match)=false then raise exception 'Vanaf promotieklasse is geen clubscheidsrechter nodig.';end if;
 if code is null then raise exception 'Teamniveau ontbreekt. Controleer de teamlijst en het competitieniveau.';end if;
 return public.create_match_referee_duty(p_match,p_points,p_minutes,public.referee_qualification_rank(code));
end;
$$;
create or replace function public.set_duty_qualification(p_duty uuid,p_qualification text) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 select * into d from public.duties where id=p_duty for update;
 if not found or d.kind<>'referee' then raise exception 'Fluitdienst niet gevonden.';end if;
 if d.match_id is not null then raise exception 'Het niveau van een wedstrijddienst wordt automatisch uit het teamniveau bepaald.';end if;
 if public.referee_qualification_rank(p_qualification) is null then raise exception 'Kies een geldig scheidsrechtersniveau.';end if;
 update public.duties set required_qualification=p_qualification,required_level=public.referee_qualification_rank(p_qualification) where id=p_duty;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'set_duty_qualification',p_duty,jsonb_build_object('qualification',p_qualification));
end;
$$;
create or replace function public.create_team_with_level(p_season uuid,p_name text,p_age text,p_competition text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_competition is null or p_competition not in ('Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie','Promotieklasse','Hoofdklasse','Eerste klasse','Tweede klasse','Derde klasse','Vierde klasse','Overig') then raise exception 'Kies een geldig competitieniveau.';end if;
 insert into public.teams(season_id,name,age_class,competition_level) values(p_season,p_name,p_age,nullif(p_competition,'Overig'));
end;
$$;
create or replace function public.update_team_competition(p_team uuid,p_competition text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_competition is null or p_competition not in ('Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie','Promotieklasse','Hoofdklasse','Eerste klasse','Tweede klasse','Derde klasse','Vierde klasse','Overig') then raise exception 'Kies een geldig competitieniveau.';end if;
 update public.teams set competition_level=nullif(p_competition,'Overig') where id=p_team;
 if not found then raise exception 'Team niet gevonden.';end if;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'update_team_competition',p_team,jsonb_build_object('competition',p_competition));
end;
$$;
revoke all on function public.keistad_team_key(text),public.team_referee_requirement(text,text),public.match_referee_requirement(uuid),public.match_needs_club_referee(uuid),public.derive_match_duty_requirement(),public.guard_referee_qualification(),public.recheck_future_referees(uuid,uuid),public.recheck_changed_duty_referees(),public.recheck_changed_member_referees(),public.refresh_match_referee_requirements(uuid),public.refresh_changed_team_requirements(),public.refresh_changed_match_requirements() from public,anon,authenticated;
revoke all on function public.create_automatic_match_duty(uuid,numeric,integer),public.create_team_with_level(uuid,text,text,text),public.update_team_competition(uuid,text) from public,anon;
grant execute on function public.create_automatic_match_duty(uuid,numeric,integer),public.create_team_with_level(uuid,text,text,text),public.update_team_competition(uuid,text) to authenticated;
-- No backfill here: it must run atomically after the team list is imported,
-- rather than interpreting all old/empty team levels as V6 during deployment.
commit;
