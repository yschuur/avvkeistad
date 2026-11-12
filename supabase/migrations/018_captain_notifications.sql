-- Apply after 017. In-app notifications only; no email or start-time reminders.
begin;
alter table public.notifications add column if not exists team_id uuid references public.teams(id) on delete set null;

create or replace function public.notify_team_captains(p_team uuid,p_duty uuid,p_title text,p_body text) returns void
language plpgsql security definer set search_path='' as $$
begin
 insert into public.notifications(member_id,team_id,title,body)
 select distinct m.member_id,p_team,p_title,p_body
 from public.duties d join public.seasons s on s.id=d.season_id and s.active
 join public.memberships m on m.season_id=d.season_id and m.team_id=p_team and m.captain
 where d.id=p_duty and not d.cancelled and d.starts_at>now();
end;$$;

create or replace function public.notify_captains_duty_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous uuid[]:='{}';current_teams uuid[];t uuid;team_name text;added integer;total integer;unfilled integer;
begin
 if new.cancelled or new.signup_closed or new.starts_at<=now() then return new;end if;
 current_teams:=public.duty_slot_teams(new);
 if tg_op='UPDATE' then previous:=public.duty_slot_teams(old);end if;
 for t in select distinct x from unnest(current_teams) x where x is not null loop
  select count(*)::integer into added from generate_series(1,new.capacity) i where current_teams[i]=t and previous[i] is distinct from t;
  if added=0 then continue;end if;
  select name into team_name from public.teams where id=t and season_id=new.season_id;
  select count(*)::integer,count(*) filter(where not exists(select 1 from public.enrollments e where e.duty_id=new.id and e.slot_number=i and not e.revoked))::integer into total,unfilled
   from generate_series(1,new.capacity) i where current_teams[i]=t;
  perform public.notify_team_captains(t,new.id,'Nieuwe teamdienst toegewezen',
   format('Voor %s %s %s %s nieuw toegewezen aan %s. Je team heeft nu %s %s, waarvan %s nog in te vullen.',team_name,case when added=1 then 'is' else 'zijn' end,added,case when added=1 then 'plek' else 'plekken' end,new.title,total,case when total=1 then 'plek' else 'plekken' end,unfilled)||E'\n'||
   format('%s · %s–%s · %s',to_char(new.starts_at at time zone 'Europe/Amsterdam','DD-MM-YYYY'),to_char(new.starts_at at time zone 'Europe/Amsterdam','HH24:MI'),to_char(new.ends_at at time zone 'Europe/Amsterdam','HH24:MI'),new.location));
 end loop;
 return new;
end;$$;
drop trigger if exists captain_duty_assignment_notification on public.duties;
create trigger captain_duty_assignment_notification after insert or update of slot_team_ids,assigned_team_id,capacity on public.duties for each row execute function public.notify_captains_duty_assignment();

create or replace function public.notify_captains_member_enrollment(p_duty uuid,p_member uuid,p_enrolled boolean,p_reason text default null) returns void
language plpgsql security definer set search_path='' as $$
declare d public.duties;t uuid;team_name text;member_name text;heading text;message text;
begin
 select * into d from public.duties where id=p_duty;
 if not found then return;end if;
 select m.team_id,tm.name,trim(p.first_name||' '||p.last_name) into t,team_name,member_name
 from public.memberships m join public.teams tm on tm.id=m.team_id and tm.season_id=m.season_id join public.profiles p on p.id=m.member_id
 where m.member_id=p_member and m.season_id=d.season_id;
 if t is null then return;end if;
 heading:=case when p_enrolled then 'Teamlid ingepland' when p_reason='Afgemeld binnen 24 uur' then 'Teamlid afgemeld' else 'Inplanning teamlid ingetrokken' end;
 message:=format('%s (%s) is %s voor %s.',member_name,team_name,case when p_enrolled then 'ingepland' else 'niet meer ingepland' end,d.title)||E'\n'||
  format('%s · %s–%s · %s',to_char(d.starts_at at time zone 'Europe/Amsterdam','DD-MM-YYYY'),to_char(d.starts_at at time zone 'Europe/Amsterdam','HH24:MI'),to_char(d.ends_at at time zone 'Europe/Amsterdam','HH24:MI'),d.location);
 if not p_enrolled and nullif(trim(p_reason),'') is not null then message:=message||E'\nReden: '||p_reason;end if;
 perform public.notify_team_captains(t,p_duty,heading,message);
end;$$;

create or replace function public.notify_captains_enrollment_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if not old.revoked and (new.revoked or new.member_id is distinct from old.member_id or new.duty_id is distinct from old.duty_id) then
   perform public.notify_captains_member_enrollment(old.duty_id,old.member_id,false,new.revoked_reason);
  end if;
 end if;
 if not new.revoked and (tg_op='INSERT' or old.revoked or new.member_id is distinct from old.member_id or new.duty_id is distinct from old.duty_id) then
  perform public.notify_captains_member_enrollment(new.duty_id,new.member_id,true,null);
 end if;
 return new;
end;$$;
drop trigger if exists captain_enrollment_notification on public.enrollments;
create trigger captain_enrollment_notification after insert or update of revoked,member_id,duty_id on public.enrollments for each row execute function public.notify_captains_enrollment_change();
revoke all on function public.notify_team_captains(uuid,uuid,text,text),public.notify_captains_duty_assignment(),public.notify_captains_member_enrollment(uuid,uuid,boolean,text),public.notify_captains_enrollment_change() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
