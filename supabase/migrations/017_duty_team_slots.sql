-- Apply after 016. Existing whole-duty reservations and enrollments are preserved.
begin;
alter table public.duties add column if not exists slot_team_ids uuid[];
alter table public.enrollments add column if not exists slot_number integer check(slot_number>0);
with numbered as (select id,row_number() over(partition by duty_id order by created_at,id)::integer n from public.enrollments where not revoked)
update public.enrollments e set slot_number=n.n from numbered n where e.id=n.id and e.slot_number is null;
create unique index if not exists one_active_duty_slot on public.enrollments(duty_id,slot_number) where not revoked;

create or replace function public.duty_slot_teams(d public.duties) returns uuid[]
language sql immutable set search_path='' as $$ select coalesce(d.slot_team_ids,array_fill(d.assigned_team_id,array[d.capacity])); $$;

create or replace function public.guard_duty_slots() returns trigger
language plpgsql security definer set search_path='' as $$
declare teams uuid[];t uuid;reason text;
begin
 if new.slot_team_ids is not null and tg_op='UPDATE' and new.capacity<>old.capacity and new.slot_team_ids is not distinct from old.slot_team_ids then
  if new.capacity<old.capacity and (exists(select 1 from unnest(new.slot_team_ids[new.capacity+1:old.capacity]) x where x is not null) or exists(select 1 from public.enrollments where duty_id=new.id and not revoked and slot_number>new.capacity)) then
   raise exception 'Maak de vervallende plekken eerst vrij van teams en deelnemers.';
  end if;
  new.slot_team_ids:=case when new.capacity<old.capacity then new.slot_team_ids[1:new.capacity] else new.slot_team_ids||array_fill(null::uuid,array[new.capacity-old.capacity]) end;
 end if;
 teams:=public.duty_slot_teams(new);
 if new.slot_team_ids is not null then new.assigned_team_id:=case when not exists(select 1 from unnest(teams) x where x is distinct from teams[1]) then teams[1] else null end;end if;
 if cardinality(teams)<>new.capacity or array_ndims(teams)<>1 or array_lower(teams,1)<>1 then raise exception 'Kies voor iedere plek een team of Open voor alle teams.';end if;
 for t in select distinct x from unnest(teams) x where x is not null loop
  if not exists(select 1 from public.teams where id=t and season_id=new.season_id) then raise exception 'Kies een team uit hetzelfde seizoen als de dienst.';end if;
  if not new.cancelled and new.starts_at>now() then
   reason:=public.team_match_conflict(new.season_id,t,new.starts_at,new.ends_at);
   if reason is not null then raise exception 'Team niet beschikbaar: %.',reason;end if;
  end if;
 end loop;
 if exists(select 1 from public.enrollments e left join public.memberships m on m.member_id=e.member_id and m.season_id=new.season_id where e.duty_id=new.id and not e.revoked and (e.slot_number>new.capacity or (teams[e.slot_number] is not null and teams[e.slot_number] is distinct from m.team_id))) then
  raise exception 'Een plek is al ingevuld door een lid van een ander team. Trek die inschrijving eerst in.';
 end if;
 return new;
end;$$;
drop trigger if exists duty_slots_guard on public.duties;
create trigger duty_slots_guard before insert or update of slot_team_ids,capacity,assigned_team_id on public.duties for each row execute function public.guard_duty_slots();

-- Manual time edits validate every reserved team. Source imports keep existing assignments.
create or replace function public.assert_duty_match_availability(p_duty uuid,p_season uuid,p_team uuid,p_start timestamptz,p_end timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare t uuid;reason text;
begin
 for t in select p_team union select unnest(public.duty_slot_teams(d)) from public.duties d where d.id=p_duty loop
  if t is not null then reason:=public.team_match_conflict(p_season,t,p_start,p_end);if reason is not null then raise exception 'Team niet beschikbaar: %.',reason;end if;end if;
 end loop;
 for t in select m.team_id from public.enrollments e join public.memberships m on m.member_id=e.member_id and m.season_id=p_season where e.duty_id=p_duty and not e.revoked loop
  reason:=public.team_match_conflict(p_season,t,p_start,p_end);if reason is not null then raise exception 'Een ingepland lid is niet beschikbaar: %.',reason;end if;
 end loop;
end;$$;

create or replace function public.assign_duty_slots(p_duty uuid,p_teams uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;common_team uuid;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 select * into d from public.duties where id=p_duty for update;
 if not found then raise exception 'Dienst niet gevonden.';end if;
 if d.cancelled or d.signup_closed or d.starts_at<=now() then raise exception 'Alleen een openstaande toekomstige dienst kan aan een team worden toegewezen.';end if;
 if p_teams is null or cardinality(p_teams)<>d.capacity or array_ndims(p_teams)<>1 or array_lower(p_teams,1)<>1 then raise exception 'Kies voor iedere plek een team of Open voor alle teams.';end if;
 if public.duty_slot_teams(d) is not distinct from p_teams then return;end if;
 common_team:=case when not exists(select 1 from unnest(p_teams) x where x is distinct from p_teams[1]) then p_teams[1] else null end;
 update public.duties set slot_team_ids=p_teams,assigned_team_id=common_team where id=d.id;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'assign_duty_slots',d.id,jsonb_build_object('previous_teams',public.duty_slot_teams(d),'teams',p_teams));
end;$$;
create or replace function public.assign_duty_team(p_duty uuid,p_team uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 select capacity into n from public.duties where id=p_duty for update;
 if not found then raise exception 'Dienst niet gevonden.';end if;
 perform public.assign_duty_slots(p_duty,array_fill(p_team,array[n]));
end;$$;

create or replace function public.guard_enrollment_slot() returns trigger
language plpgsql security definer set search_path='' as $$
declare d public.duties;teams uuid[];member_team uuid;chosen integer;
begin
 if new.revoked then return new;end if;
 if tg_op='UPDATE' and not(old.revoked or old.member_id is distinct from new.member_id or old.duty_id is distinct from new.duty_id or old.slot_number is distinct from new.slot_number) then return new;end if;
 select * into d from public.duties where id=new.duty_id for update;
 select team_id into member_team from public.memberships where member_id=new.member_id and season_id=d.season_id;
 if member_team is null then raise exception 'Een teamindeling voor dit seizoen is verplicht.';end if;
 teams:=public.duty_slot_teams(d);
 if new.slot_number is null then
  select i into chosen from generate_series(1,d.capacity) i
  where (teams[i] is null or teams[i]=member_team) and not exists(select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked and e.slot_number=i and e.id<>new.id)
  order by (teams[i] is null),i limit 1;
  new.slot_number:=chosen;
 end if;
 if new.slot_number is null or new.slot_number not between 1 and d.capacity then raise exception 'Geen vrije plek beschikbaar voor dit team.';end if;
 if teams[new.slot_number] is not null and teams[new.slot_number]<>member_team then raise exception 'Deze plek is voor een ander team gereserveerd.';end if;
 if exists(select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked and e.slot_number=new.slot_number and e.id<>new.id) then raise exception 'Deze plek is al ingevuld.';end if;
 return new;
end;$$;
drop trigger if exists enrollment_slot_guard on public.enrollments;
create trigger enrollment_slot_guard before insert or update of duty_id,member_id,revoked,slot_number on public.enrollments for each row execute function public.guard_enrollment_slot();

create or replace function public.enroll_duty_slot(p_duty uuid,p_slot integer default null,p_member uuid default null,p_takeover uuid default null) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;target uuid:=coalesce(p_member,auth.uid());previous public.enrollments;member_team uuid;teams uuid[];chosen integer:=p_slot;
begin
 if auth.uid() is null then raise exception 'Log eerst in.';end if;
 select * into d from public.duties where id=p_duty for update;
 if not found or d.cancelled or d.signup_closed or d.starts_at<=now() then raise exception 'Deze dienst is niet meer beschikbaar.';end if;
 perform 1 from public.profiles where id=target for update;
 select team_id into member_team from public.memberships where member_id=target and season_id=d.season_id;
 if member_team is null then raise exception 'Een teamindeling voor dit seizoen is verplicht.';end if;
 teams:=public.duty_slot_teams(d);
 if target<>auth.uid() and not public.is_manager() and not exists(select 1 from public.memberships c where c.member_id=auth.uid() and c.captain and c.season_id=d.season_id and c.team_id=member_team and member_team=any(teams)) then raise exception 'Je mag deze deelnemer niet toewijzen.';end if;
 if p_takeover is not null then
  select * into previous from public.enrollments where id=p_takeover and duty_id=d.id and offered and not revoked for update;
  if not found or previous.member_id=target or (chosen is not null and chosen<>previous.slot_number) then raise exception 'Deze dienst kan niet meer worden overgenomen.';end if;
  chosen:=previous.slot_number;
 end if;
 -- A captain assigning another member can only fill that team's reserved places.
 if target<>auth.uid() and not public.is_manager() then
  if chosen is null then select i into chosen from generate_series(1,d.capacity) i where teams[i]=member_team and not exists(select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked and e.slot_number=i) order by i limit 1;end if;
  if chosen is null or teams[chosen] is distinct from member_team then raise exception 'Geen vrije toegewezen plek voor jouw team.';end if;
 end if;
 if not exists(select 1 from public.profiles where id=target and referee_level>=d.required_level) then raise exception 'De scheidsrechtersbevoegdheid is onvoldoende.';end if;
 if exists(select 1 from public.enrollments e join public.duties other on other.id=e.duty_id where e.member_id=target and not e.revoked and not other.cancelled and other.starts_at<d.ends_at and other.ends_at>d.starts_at) then raise exception 'Deze dienst overlapt met een bestaande inschrijving.';end if;
 if p_takeover is not null then update public.enrollments set revoked=true,revoked_at=now(),revoked_reason='Overgenomen',offered=false where id=previous.id;end if;
 insert into public.enrollments(duty_id,member_id,slot_number) values(d.id,target,chosen) returning slot_number into chosen;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'enroll',d.id,jsonb_build_object('member_id',target,'takeover',p_takeover,'slot',chosen));
end;$$;
create or replace function public.enroll(p_duty uuid,p_member uuid default null,p_takeover uuid default null) returns void
language plpgsql security definer set search_path='' as $$ begin perform public.enroll_duty_slot(p_duty,null,p_member,p_takeover);end;$$;

-- Only reservation IDs and occupancy, never member identities, are shared.
drop function public.duty_availability();
create function public.duty_availability() returns table(duty_id uuid,occupied bigint,offered_ids uuid[],slots jsonb)
language sql stable security definer set search_path='' as $$
 select d.id,(select count(*) from public.enrollments e where e.duty_id=d.id and not e.revoked),
 coalesce((select array_agg(e.id) from public.enrollments e where e.duty_id=d.id and not e.revoked and e.offered),'{}'::uuid[]),
 (select jsonb_agg(jsonb_build_object('slot',i,'team_id',(public.duty_slot_teams(d))[i],'occupied',exists(select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked and e.slot_number=i),'offered_id',(select e.id from public.enrollments e where e.duty_id=d.id and not e.revoked and e.offered and e.slot_number=i)) order by i) from generate_series(1,d.capacity) i)
 from public.duties d where auth.uid() is not null;
$$;
create or replace function public.captain_team_duty_count() returns integer
language sql stable security definer set search_path='' as $$
 select count(*)::integer from public.duties d join public.seasons s on s.id=d.season_id and s.active
 where not d.cancelled and not d.signup_closed and d.starts_at>now() and exists(
  select 1 from public.memberships m cross join lateral generate_series(1,d.capacity) i
  where m.member_id=auth.uid() and m.captain and m.season_id=d.season_id and (public.duty_slot_teams(d))[i]=m.team_id
  and not exists(select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked and e.slot_number=i));
$$;
revoke all on function public.duty_slot_teams(public.duties),public.guard_duty_slots(),public.guard_enrollment_slot() from public,anon,authenticated;
revoke all on function public.assign_duty_slots(uuid,uuid[]),public.enroll_duty_slot(uuid,integer,uuid,uuid),public.duty_availability(),public.captain_team_duty_count() from public,anon;
grant execute on function public.assign_duty_slots(uuid,uuid[]),public.enroll_duty_slot(uuid,integer,uuid,uuid),public.duty_availability(),public.captain_team_duty_count() to authenticated;
notify pgrst,'reload schema';
commit;
