-- Explicit Nevobo qualifications. Old numeric levels have no documented mapping:
-- retain them without assigning an unverified qualification to existing members.
begin;
alter table public.profiles add column if not exists referee_qualification text
 check(referee_qualification in ('V6','V4','R2.2','R2','R1','N3','N2','N1'));
alter table public.duties add column if not exists required_qualification text
 check(required_qualification in ('V6','V4','R2.2','R2','R1','N3','N2','N1'));
create or replace function public.referee_qualification_rank(p_code text) returns integer
language sql immutable set search_path='' as $$
 select case p_code when 'V6' then 1 when 'V4' then 2 when 'R2.2' then 3 when 'R2' then 4 when 'R1' then 5 when 'N3' then 6 when 'N2' then 7 when 'N1' then 8 end;
$$;
create or replace function public.update_member_qualification(p_member uuid,p_season uuid,p_team uuid,p_captain boolean,p_norm numeric,p_qualification text) returns void
language plpgsql security definer set search_path='' as $$
declare previous_level integer;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_qualification is not null and public.referee_qualification_rank(p_qualification) is null then raise exception 'Kies een geldig scheidsrechtersniveau.';end if;
 select referee_level into previous_level from public.profiles where id=p_member for update;
 if not found then raise exception 'Lid niet gevonden.';end if;
 perform public.update_member(p_member,p_season,p_team,p_captain,p_norm,coalesce(public.referee_qualification_rank(p_qualification),previous_level));
 update public.profiles set referee_qualification=p_qualification where id=p_member;
end;
$$;
create or replace function public.create_qualified_duty(p_season uuid,p_title text,p_kind text,p_start timestamptz,p_end timestamptz,p_location text,p_capacity integer,p_points numeric,p_qualification text default null,p_team uuid default null,p_repeat integer default 1) returns void
language plpgsql security definer set search_path='' as $$
declare i integer; s public.seasons; start_local timestamp; end_local timestamp; generated_start timestamptz; generated_end timestamptz; series uuid:=gen_random_uuid();
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
 if p_kind='referee' and public.referee_qualification_rank(p_qualification) is null then raise exception 'Kies een geldig scheidsrechtersniveau.';end if;
 if p_repeat is null or p_repeat not between 1 and 53 then raise exception 'Kies 1 tot 53 herhalingen.'; end if;
 select * into s from public.seasons where id=p_season;
 if not found then raise exception 'Seizoen niet gevonden.'; end if;
 start_local:=p_start at time zone 'Europe/Amsterdam'; end_local:=p_end at time zone 'Europe/Amsterdam';
 for i in 0..p_repeat-1 loop
  generated_start:=(start_local+make_interval(days=>i*7)) at time zone 'Europe/Amsterdam';
  generated_end:=(end_local+make_interval(days=>i*7)) at time zone 'Europe/Amsterdam';
  if generated_start::date<s.starts_on or generated_end::date>s.ends_on then raise exception 'De reeks valt buiten het seizoen.'; end if;
  insert into public.duties(season_id,title,kind,starts_at,ends_at,location,capacity,points,required_level,required_qualification,assigned_team_id,series_id)
   values(p_season,p_title,p_kind,generated_start,generated_end,p_location,p_capacity,
    case when p_kind='referee' then p_points else extract(epoch from (generated_end-generated_start))/3600 end,case when p_kind='referee' then public.referee_qualification_rank(p_qualification) else 0 end,case when p_kind='referee' then p_qualification else null end,p_team,case when p_repeat>1 then series else null end);
 end loop;
 insert into public.audit_log(actor_id,action,details) values(auth.uid(),'create_duty',jsonb_build_object('title',p_title,'count',p_repeat));
end;
$$;

create or replace function public.create_qualified_match_duty(p_match uuid,p_points numeric,p_minutes integer,p_qualification text) returns uuid
language plpgsql security definer set search_path='' as $$
declare duty uuid;rank integer:=public.referee_qualification_rank(p_qualification);
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if rank is null then raise exception 'Kies een geldig scheidsrechtersniveau.';end if;
 duty:=public.create_match_referee_duty(p_match,p_points,p_minutes,rank);
 update public.duties set required_qualification=p_qualification where id=duty;
 return duty;
end;
$$;
create or replace function public.set_duty_qualification(p_duty uuid,p_qualification text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if public.referee_qualification_rank(p_qualification) is null then raise exception 'Kies een geldig scheidsrechtersniveau.';end if;
 update public.duties set required_qualification=p_qualification,required_level=public.referee_qualification_rank(p_qualification) where id=p_duty and kind='referee';
 if not found then raise exception 'Fluitdienst niet gevonden.';end if;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'set_duty_qualification',p_duty,jsonb_build_object('qualification',p_qualification));
end;
$$;
-- This also protects legacy RPCs, team assignments and takeovers. Only a new
-- or restored enrollment needs qualification checks; existing responsibilities,
-- offers and retrospective corrections remain intact.
create or replace function public.guard_referee_qualification() returns trigger
language plpgsql security definer set search_path='' as $$
declare duty public.duties;qualification text;
begin
 if new.revoked then return new;end if;
 if tg_op='UPDATE' and not(old.revoked or old.member_id is distinct from new.member_id or old.duty_id is distinct from new.duty_id) then return new;end if;
 select * into duty from public.duties where id=new.duty_id for update;
 if duty.kind<>'referee' then return new;end if;
 if duty.required_qualification is null then raise exception 'De beheerder moet het vereiste scheidsrechtersniveau instellen.';end if;
 select referee_qualification into qualification from public.profiles where id=new.member_id for update;
 if qualification is null then raise exception 'Het scheidsrechtersniveau van dit lid is nog niet ingesteld.';end if;
 if public.referee_qualification_rank(qualification)<public.referee_qualification_rank(duty.required_qualification) then raise exception 'De scheidsrechtersbevoegdheid is onvoldoende.';end if;
 return new;
end;
$$;
drop trigger if exists referee_qualification_guard on public.enrollments;
create trigger referee_qualification_guard before insert or update of duty_id,member_id,revoked on public.enrollments for each row execute function public.guard_referee_qualification();
revoke all on function public.referee_qualification_rank(text),public.guard_referee_qualification() from public,anon,authenticated;
revoke all on function public.update_member_qualification(uuid,uuid,uuid,boolean,numeric,text),public.create_qualified_duty(uuid,text,text,timestamptz,timestamptz,text,integer,numeric,text,uuid,integer),public.create_qualified_match_duty(uuid,numeric,integer,text),public.set_duty_qualification(uuid,text) from public,anon;
grant execute on function public.update_member_qualification(uuid,uuid,uuid,boolean,numeric,text),public.create_qualified_duty(uuid,text,text,timestamptz,timestamptz,text,integer,numeric,text,uuid,integer),public.create_qualified_match_duty(uuid,numeric,integer,text),public.set_duty_qualification(uuid,text) to authenticated;
commit;
