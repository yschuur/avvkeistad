-- Apply after 015. Match duration: 120 minutes. Away travel: 180 minutes
-- on both sides of the match. Exact boundary times are available.
begin;
create or replace function public.team_match_conflict(p_season uuid,p_team uuid,p_start timestamptz,p_end timestamptz) returns text
language sql stable security definer set search_path='' as $$
 select case when public.keistad_team_key(m.home_team)=public.keistad_team_key(t.name) and m.home_team~*'\mkeistad\s+' then 'Eigen thuiswedstrijd' else 'Uitwedstrijd / reistijd' end
 from public.teams t join public.matches m on m.season_id=t.season_id
 where t.id=p_team and t.season_id=p_season and not m.cancelled and m.status in ('scheduled','played') and m.starts_at is not null
 and public.keistad_team_key(t.name) is not null
 and ((m.home_team~*'\mkeistad\s+' and public.keistad_team_key(m.home_team)=public.keistad_team_key(t.name)) or (m.away_team~*'\mkeistad\s+' and public.keistad_team_key(m.away_team)=public.keistad_team_key(t.name)))
 and p_start<m.starts_at+interval '120 minutes'+case when m.home_team~*'\mkeistad\s+' and public.keistad_team_key(m.home_team)=public.keistad_team_key(t.name) then interval '0 minutes' else interval '180 minutes' end
 and p_end>m.starts_at-case when m.home_team~*'\mkeistad\s+' and public.keistad_team_key(m.home_team)=public.keistad_team_key(t.name) then interval '0 minutes' else interval '180 minutes' end
 order by m.starts_at,m.id limit 1;
$$;
create or replace function public.assert_duty_match_availability(p_duty uuid,p_season uuid,p_team uuid,p_start timestamptz,p_end timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare reason text;member_team uuid;
begin
 if p_team is not null then
  reason:=public.team_match_conflict(p_season,p_team,p_start,p_end);
  if reason is not null then raise exception 'Team niet beschikbaar: %.',reason;end if;
 end if;
 for member_team in select m.team_id from public.enrollments e join public.memberships m on m.member_id=e.member_id and m.season_id=p_season where e.duty_id=p_duty and not e.revoked loop
  reason:=public.team_match_conflict(p_season,member_team,p_start,p_end);
  if reason is not null then raise exception 'Een ingepland lid is niet beschikbaar: %.',reason;end if;
 end loop;
end;$$;
create or replace function public.guard_duty_team_match() returns trigger
language plpgsql security definer set search_path='' as $$
declare reason text;
begin
 if new.cancelled or new.starts_at<=now() or new.assigned_team_id is null then return new;end if;
 reason:=public.team_match_conflict(new.season_id,new.assigned_team_id,new.starts_at,new.ends_at);
 if reason is not null then raise exception 'Team niet beschikbaar: %.',reason;end if;
 return new;
end;$$;
drop trigger if exists duty_team_match_guard on public.duties;
create trigger duty_team_match_guard before insert or update of assigned_team_id on public.duties for each row execute function public.guard_duty_team_match();
create or replace function public.guard_enrollment_match() returns trigger
language plpgsql security definer set search_path='' as $$
declare d public.duties;member_team uuid;reason text;
begin
 if new.revoked then return new;end if;
 if tg_op='UPDATE' and not(old.revoked or old.member_id is distinct from new.member_id or old.duty_id is distinct from new.duty_id) then return new;end if;
 select * into d from public.duties where id=new.duty_id for update;
 if d.cancelled or d.starts_at<=now() then return new;end if;
 perform 1 from public.profiles where id=new.member_id for update;
 select team_id into member_team from public.memberships where member_id=new.member_id and season_id=d.season_id;
 reason:=public.team_match_conflict(d.season_id,member_team,d.starts_at,d.ends_at);
 if reason is not null then raise exception 'Lid niet beschikbaar: %.',reason;end if;
 return new;
end;$$;
drop trigger if exists enrollment_match_guard on public.enrollments;
create trigger enrollment_match_guard before insert or update of duty_id,member_id,revoked on public.enrollments for each row execute function public.guard_enrollment_match();
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
 if p_team is not null then perform public.assert_duty_match_availability(d.id,d.season_id,p_team,d.starts_at,d.ends_at);end if;
 if d.assigned_team_id is not distinct from p_team then return;end if;
 if p_team is not null and exists(
  select 1 from public.enrollments e where e.duty_id=d.id and not e.revoked
  and not exists(select 1 from public.memberships m where m.member_id=e.member_id and m.season_id=d.season_id and m.team_id=p_team)
 ) then raise exception 'Er zijn al deelnemers buiten dit team ingeschreven. Trek hun inschrijving eerst in of kies hun team.';end if;
 update public.duties set assigned_team_id=p_team where id=d.id;
 insert into public.audit_log(actor_id,action,entity_id,details)
 values(auth.uid(),'assign_duty_team',d.id,jsonb_build_object('previous_team_id',d.assigned_team_id,'team_id',p_team,'match_id',d.match_id));
end;$$;

create or replace function public.update_managed_duty(p_duty uuid,p_title text,p_location text,p_start timestamptz,p_end timestamptz,p_capacity integer) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;new_points numeric;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 select * into d from public.duties where id=p_duty for update;
 if not found then raise exception 'Dienst niet gevonden.';end if;
 if d.cancelled or d.signup_closed or d.starts_at<=now() then raise exception 'Alleen komende open diensten kunnen worden gewijzigd.';end if;
 if d.match_id is not null then raise exception 'Wedstrijdgegevens volgen Nevobo. Gebruik team- of lidtoewijzing.';end if;
 if p_title is null or length(trim(p_title)) not between 1 and 200 or p_location is null or length(trim(p_location)) not between 1 and 500 then raise exception 'Vul een titel en locatie in.';end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_start<=now() or p_end<=p_start then raise exception 'Kies geldige toekomstige begin- en eindtijden.';end if;
 if not exists(select 1 from public.seasons s where s.id=d.season_id and (p_start at time zone 'Europe/Amsterdam')::date>=s.starts_on and (p_end at time zone 'Europe/Amsterdam')::date<=s.ends_on) then raise exception 'De dienst moet binnen het seizoen vallen.';end if;
 if p_capacity is null or p_capacity not between 1 and 100 or p_capacity<(select count(*) from public.enrollments where duty_id=d.id and not revoked) then raise exception 'Het aantal plaatsen mag niet lager zijn dan het aantal deelnemers.';end if;
 perform public.assert_duty_match_availability(d.id,d.season_id,d.assigned_team_id,p_start,p_end);
 -- Serialize with enrollment's member lock, after locking this duty.
 perform 1 from public.profiles p where p.id in (select e.member_id from public.enrollments e where e.duty_id=d.id and not e.revoked) order by p.id for update;
 if exists(select 1 from public.enrollments e join public.enrollments other on other.member_id=e.member_id and other.duty_id<>d.id and not other.revoked join public.duties od on od.id=other.duty_id and not od.cancelled where e.duty_id=d.id and not e.revoked and od.starts_at<p_end and p_start<od.ends_at) then raise exception 'Een deelnemer heeft op deze tijden al een andere dienst. Pas eerst de toewijzing aan.';end if;
 new_points:=case when d.kind='referee' then d.points else round((extract(epoch from (p_end-p_start))/3600)::numeric,2) end;
 if new_points<=0 or new_points>999999.99 then raise exception 'De duur levert geen geldig puntenaantal op.';end if;
 update public.duties set title=trim(p_title),location=trim(p_location),starts_at=p_start,ends_at=p_end,capacity=p_capacity,points=new_points where id=d.id;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'update_duty',d.id,jsonb_build_object('before',to_jsonb(d),'title',trim(p_title),'location',trim(p_location),'starts_at',p_start,'ends_at',p_end,'capacity',p_capacity,'points',new_points));
 if row(d.title,d.location,d.starts_at,d.ends_at,d.points) is distinct from row(trim(p_title),trim(p_location),p_start,p_end,new_points) then
  insert into public.notifications(member_id,title,body) select e.member_id,'Dienst gewijzigd',format('%s · %s · %s',trim(p_title),to_char(p_start at time zone 'Europe/Amsterdam','DD-MM-YYYY HH24:MI'),trim(p_location)) from public.enrollments e where e.duty_id=d.id and not e.revoked;
 end if;
end;$$;
revoke all on function public.team_match_conflict(uuid,uuid,timestamptz,timestamptz),public.assert_duty_match_availability(uuid,uuid,uuid,timestamptz,timestamptz),public.guard_duty_team_match(),public.guard_enrollment_match() from public,anon,authenticated;
revoke all on function public.assign_duty_team(uuid,uuid),public.update_managed_duty(uuid,text,text,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.assign_duty_team(uuid,uuid),public.update_managed_duty(uuid,text,text,timestamptz,timestamptz,integer) to authenticated;
notify pgrst,'reload schema';
commit;
