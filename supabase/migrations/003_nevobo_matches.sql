-- Nevobo import, match history, referee notifications and reliable mail outbox.
-- Additive: existing members, enrollments and points are preserved.
begin;
alter table public.matches alter column starts_at drop not null;
alter table public.matches add column if not exists status text not null default 'scheduled'
 check(status in ('scheduled','played','cancelled','postponed','missing'));
alter table public.matches add column if not exists address text;
alter table public.matches add column if not exists city text;
alter table public.matches add column if not exists postal_code text;
alter table public.matches add column if not exists court text;
alter table public.matches add column if not exists match_code text;
alter table public.matches add column if not exists source_url text;
alter table public.matches add column if not exists source_description text;
alter table public.matches add column if not exists source_details jsonb not null default '{}';
alter table public.matches add column if not exists is_home boolean;
alter table public.matches add column if not exists revision integer not null default 1;
alter table public.matches add column if not exists last_seen_at timestamptz;
alter table public.duties add column if not exists signup_closed boolean not null default false;
alter table public.duties add column if not exists credit_blocked boolean not null default false;
alter table public.duties add column if not exists nevobo_cancelled boolean not null default false;
create index if not exists duties_match_id on public.duties(match_id) where match_id is not null;
create index if not exists matches_season_start on public.matches(season_id,starts_at);
create table if not exists public.nevobo_sync_state (
 id boolean primary key default true check(id),last_started_at timestamptz,last_success_at timestamptz,
 last_error_code text,lease_id uuid,lease_until timestamptz,feed_published_at timestamptz,
 imported_count integer not null default 0,updated_count integer not null default 0
);
insert into public.nevobo_sync_state(id) values(true) on conflict(id) do nothing;
create table if not exists public.match_events (
 id uuid primary key default gen_random_uuid(),match_id uuid not null references public.matches(id),
 revision integer not null,kind text not null,old_state jsonb not null,new_state jsonb not null,
 created_at timestamptz not null default now(),unique(match_id,revision)
);
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),member_id uuid not null references public.profiles(id),
 event_id uuid references public.match_events(id),match_id uuid references public.matches(id),
 title text not null,body text not null,created_at timestamptz not null default now(),read_at timestamptz,
 unique(event_id,member_id)
);
create index if not exists notifications_member_unread on public.notifications(member_id,created_at desc) where read_at is null;
create table if not exists public.notification_email_outbox (
 id uuid primary key default gen_random_uuid(),notification_id uuid not null unique references public.notifications(id),
 state text not null default 'pending' check(state in ('pending','processing','sent','failed')),
 attempts integer not null default 0,available_at timestamptz not null default now(),
 claim_token uuid,locked_until timestamptz,provider_id text,last_error_code text,sent_at timestamptz
);
alter table public.nevobo_sync_state enable row level security;
alter table public.match_events enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_email_outbox enable row level security;
drop policy if exists nevobo_state_read on public.nevobo_sync_state;
create policy nevobo_state_read on public.nevobo_sync_state for select to authenticated using(true);
drop policy if exists match_events_manager_read on public.match_events;
create policy match_events_manager_read on public.match_events for select to authenticated using(public.is_manager());
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using(member_id=auth.uid() or public.is_manager());
drop policy if exists outbox_manager_read on public.notification_email_outbox;
create policy outbox_manager_read on public.notification_email_outbox for select to authenticated using(public.is_manager());
revoke all on public.nevobo_sync_state,public.match_events,public.notifications,public.notification_email_outbox from public,anon,authenticated;
grant select(last_started_at,last_success_at,last_error_code,feed_published_at,imported_count,updated_count) on public.nevobo_sync_state to authenticated;
grant select on public.match_events,public.notifications to authenticated;
grant select(id,state,attempts,last_error_code,sent_at) on public.notification_email_outbox to authenticated;
grant all on public.nevobo_sync_state,public.match_events,public.notifications,public.notification_email_outbox to service_role;

create or replace function public.mark_notification_read(p_notification uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.notifications set read_at=coalesce(read_at,now())
 where id=p_notification and (member_id=auth.uid() or public.is_admin());
 if not found then raise exception 'Melding niet gevonden.';end if;
end;
$$;
create or replace function public.acquire_nevobo_sync() returns uuid
language plpgsql security definer set search_path='' as $$
declare token uuid:=gen_random_uuid();
begin
 update public.nevobo_sync_state set lease_id=token,lease_until=now()+interval '3 minutes',last_started_at=now(),last_error_code=null
 where id and (lease_until is null or lease_until<now());
 if not found then return null;end if;
 return token;
end;
$$;
create or replace function public.fail_nevobo_sync(p_lease uuid,p_code text) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.nevobo_sync_state set last_error_code=left(p_code,100),lease_id=null,lease_until=null where id and lease_id=p_lease;
end;
$$;
create or replace function public.nevobo_match_state(p_match public.matches) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('starts_at',p_match.starts_at,'home_team',p_match.home_team,'away_team',p_match.away_team,
 'location',p_match.location,'address',p_match.address,'postal_code',p_match.postal_code,'city',p_match.city,'court',p_match.court,'status',p_match.status);
$$;
create or replace function public.apply_nevobo_snapshot(p_lease uuid,p_season uuid,p_matches jsonb,p_published timestamptz,p_complete boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item jsonb;before_row public.matches;after_row public.matches;s public.seasons;start_time timestamptz;
 old_state jsonb;new_state jsonb;event_uuid uuid;event_kind text;notification_title text;notification_body text;
 inserted integer:=0;changed integer:=0;skipped integer:=0;old_duty public.duties;new_start timestamptz;
begin
 perform 1 from public.nevobo_sync_state where id and lease_id=p_lease and lease_until>now() for update;
 if not found then raise exception 'Synchronisatievergrendeling verlopen.';end if;
 select * into s from public.seasons where id=p_season;
 if not found then raise exception 'Seizoen ontbreekt.';end if;
 if jsonb_typeof(p_matches)<>'array' or jsonb_array_length(p_matches)>5000 then raise exception 'Ongeldige import.';end if;
 if (select count(*) from jsonb_array_elements(p_matches))<>(select count(distinct value->>'external_id') from jsonb_array_elements(p_matches)) then raise exception 'Dubbele wedstrijdidentificatie.';end if;
 -- Missing future items are uncertain, never automatically called cancelled.
 -- The application sets p_complete only for a fully parsed, nonempty snapshot.
 if p_complete and jsonb_array_length(p_matches)>0 then
  for before_row in select * from public.matches where season_id=p_season and external_id is not null
    and last_seen_at is not null and starts_at>now() and status='scheduled'
    and not exists(select 1 from jsonb_array_elements(p_matches) entry where entry->>'external_id'=external_id)
  loop
   p_matches:=p_matches||jsonb_build_array(jsonb_build_object('external_id',before_row.external_id,'home_team',before_row.home_team,
    'away_team',before_row.away_team,'starts_at',before_row.starts_at,'location',before_row.location,'level',before_row.level,
    'address',before_row.address,'postal_code',before_row.postal_code,'city',before_row.city,'court',before_row.court,'match_code',before_row.match_code,
    'source_url',before_row.source_url,'source_description',before_row.source_description,'source_details',before_row.source_details,
    'is_home',before_row.is_home,'status','missing'));
  end loop;
 end if;
 for item in select value from jsonb_array_elements(p_matches) loop
  if nullif(item->>'external_id','') is null or nullif(item->>'home_team','') is null or nullif(item->>'away_team','') is null then raise exception 'Wedstrijdgegevens onvolledig.';end if;
  start_time:=(item->>'starts_at')::timestamptz;
  select * into before_row from public.matches where external_id=item->>'external_id' for update;
  if found and start_time is null and item->>'status' in ('cancelled','played') then start_time:=before_row.starts_at;end if;
  if before_row.id is not null and before_row.season_id<>p_season then skipped:=skipped+1;continue;end if;
  if before_row.id is null and start_time is not null and ((start_time at time zone 'Europe/Amsterdam')::date<s.starts_on or (start_time at time zone 'Europe/Amsterdam')::date>s.ends_on) then skipped:=skipped+1;continue;end if;
  insert into public.matches(season_id,external_id,home_team,away_team,starts_at,location,level,cancelled,status,address,postal_code,city,court,
    match_code,source_url,source_description,source_details,is_home,synced_at,last_seen_at)
   values(p_season,item->>'external_id',item->>'home_team',item->>'away_team',start_time,coalesce(item->>'location',''),coalesce(item->>'level',''),
    item->>'status'='cancelled',coalesce(item->>'status','scheduled'),item->>'address',item->>'postal_code',item->>'city',item->>'court',item->>'match_code',item->>'source_url',
    item->>'source_description',coalesce(item->'source_details','{}'),(item->>'is_home')::boolean,now(),case when item->>'status'='missing' then before_row.last_seen_at else now() end)
   on conflict(external_id) do update set home_team=excluded.home_team,away_team=excluded.away_team,starts_at=excluded.starts_at,
    location=excluded.location,level=excluded.level,cancelled=excluded.cancelled,status=excluded.status,address=excluded.address,postal_code=excluded.postal_code,
    city=excluded.city,court=excluded.court,match_code=excluded.match_code,source_url=excluded.source_url,source_description=excluded.source_description,
    source_details=excluded.source_details,is_home=excluded.is_home,synced_at=now(),last_seen_at=excluded.last_seen_at
   returning * into after_row;
  if before_row.id is null then inserted:=inserted+1;continue;end if;
  old_state:=public.nevobo_match_state(before_row);new_state:=public.nevobo_match_state(after_row);
  if old_state=new_state then continue;end if;
  changed:=changed+1;
  update public.matches set revision=revision+1 where id=after_row.id returning * into after_row;
  event_kind:=case when after_row.status='cancelled' then 'cancelled' when after_row.status='missing' then 'unconfirmed'
   when after_row.status='postponed' then 'postponed' when after_row.status='played' then 'played'
   when before_row.status in ('cancelled','missing','postponed') then 'restored' else 'moved' end;
  insert into public.match_events(match_id,revision,kind,old_state,new_state) values(after_row.id,after_row.revision,event_kind,old_state,new_state) returning id into event_uuid;
  notification_title:=case event_kind when 'cancelled' then 'Wedstrijd afgelast' when 'unconfirmed' then 'Wedstrijdstatus niet bevestigd'
   when 'postponed' then 'Wedstrijd uitgesteld' when 'restored' then 'Wedstrijd opnieuw ingepland' else 'Wedstrijd gewijzigd' end;
  notification_body:=format('%s – %s',after_row.home_team,after_row.away_team)||E'\n'||
   'Vorige planning: '||coalesce(to_char(before_row.starts_at at time zone 'Europe/Amsterdam','DD-MM-YYYY HH24:MI'),'niet vastgesteld')||' · '||coalesce(nullif(concat_ws(', ',nullif(before_row.location,''),nullif(before_row.address,''),nullif(concat_ws(' ',before_row.postal_code,before_row.city),''),case when before_row.court is not null then 'Veld '||before_row.court end),''),'locatie niet vermeld')||E'\n'||
   'Nieuwe planning: '||coalesce(to_char(after_row.starts_at at time zone 'Europe/Amsterdam','DD-MM-YYYY HH24:MI'),'niet vastgesteld')||' · '||coalesce(nullif(concat_ws(', ',nullif(after_row.location,''),nullif(after_row.address,''),nullif(concat_ws(' ',after_row.postal_code,after_row.city),''),case when after_row.court is not null then 'Veld '||after_row.court end),''),'locatie niet vermeld')||E'\n'||
   case event_kind when 'cancelled' then 'Nevobo meldt dat de wedstrijd is afgelast.' when 'unconfirmed' then 'De wedstrijd ontbreekt in het actuele programma. Dit is geen bevestigde afgelasting. Inschrijven is geblokkeerd totdat de planning bevestigd is.'
    when 'postponed' then 'Nevobo meldt dat de wedstrijd is uitgesteld. Controleer de nieuwe planning zodra die beschikbaar is.' else 'Controleer of deze planning nog past bij je andere diensten. Je toewijzing blijft behouden.' end;
  -- Lock before reading recipients: an enrollment that was already in flight
  -- must finish before the recipient snapshot, or observe the closed duty.
  perform 1 from public.duties where match_id=after_row.id and kind='referee' for update;
  if event_kind<>'played' then
   insert into public.notifications(member_id,event_id,match_id,title,body)
    select distinct e.member_id,event_uuid,after_row.id,notification_title,notification_body
    from public.enrollments e join public.duties d on d.id=e.duty_id
    where d.match_id=after_row.id and d.kind='referee' and not e.revoked and (not d.cancelled or d.nevobo_cancelled)
    on conflict(event_id,member_id) do nothing;
   insert into public.notification_email_outbox(notification_id)
    select id from public.notifications where event_id=event_uuid on conflict(notification_id) do nothing;
  end if;
  for old_duty in select * from public.duties where match_id=after_row.id and kind='referee' for update loop
   new_start:=coalesce(after_row.starts_at,old_duty.starts_at);
   update public.duties set title=case when old_duty.title=left(before_row.home_team||' – '||before_row.away_team,200) then left(after_row.home_team||' – '||after_row.away_team,200) else old_duty.title end,starts_at=new_start,ends_at=new_start+(old_duty.ends_at-old_duty.starts_at),
    location=coalesce(nullif(after_row.location,''),old_duty.location),
    signup_closed=after_row.status<>'scheduled' or after_row.starts_at is null or after_row.starts_at<=now(),
    credit_blocked=after_row.status in ('missing','postponed') or (after_row.starts_at is null and after_row.status<>'played'),
    cancelled=case when after_row.status='cancelled' then true when old_duty.nevobo_cancelled then false else old_duty.cancelled end,
    nevobo_cancelled=case when after_row.status='cancelled' and not old_duty.cancelled then true when after_row.status='cancelled' then old_duty.nevobo_cancelled else false end
    where id=old_duty.id;
  end loop;
 end loop;
 -- Time cutoff is enforced again during enrollment, independent of this job.
 update public.duties d set signup_closed=true from public.matches m where d.match_id=m.id and m.season_id=p_season and (m.starts_at<=now() or m.status<>'scheduled' or m.starts_at is null);
 update public.nevobo_sync_state set last_success_at=now(),last_error_code=null,lease_id=null,lease_until=null,
  feed_published_at=p_published,imported_count=inserted,updated_count=changed where id and lease_id=p_lease;
 return jsonb_build_object('inserted',inserted,'updated',changed,'skipped',skipped);
end;
$$;

create or replace function public.guard_match_enrollment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not new.revoked and exists(select 1 from public.duties d left join public.matches m on m.id=d.match_id
   where d.id=new.duty_id and (d.signup_closed or (m.id is not null and (m.cancelled or m.status<>'scheduled' or m.starts_at is null or m.starts_at<=now()))))
 then raise exception 'Deze wedstrijd is niet beschikbaar voor inschrijving.';end if;
 return new;
end;
$$;
drop trigger if exists match_enrollment_guard on public.enrollments;
create trigger match_enrollment_guard before insert or update of duty_id,member_id,revoked on public.enrollments for each row execute function public.guard_match_enrollment();
create or replace function public.create_match_referee_duty(p_match uuid,p_points numeric,p_minutes integer,p_level integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.matches;duty uuid;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 select * into m from public.matches where id=p_match for update;
 if not found or m.cancelled or m.status<>'scheduled' or m.starts_at is null or m.starts_at<=now() then raise exception 'Wedstrijd niet beschikbaar.';end if;
 if p_minutes is null or p_minutes not between 15 and 480 or p_points is null or p_points<=0 or p_level is null or p_level not between 0 and 10 then raise exception 'Controleer punten, duur en bevoegdheid.';end if;
 if exists(select 1 from public.duties where match_id=m.id and kind='referee' and not cancelled) then raise exception 'Er is al een fluitdienst gekoppeld.';end if;
 insert into public.duties(season_id,title,kind,starts_at,ends_at,location,points,capacity,required_level,match_id)
 values(m.season_id,left(m.home_team||' – '||m.away_team,200),'referee',m.starts_at,m.starts_at+make_interval(mins=>p_minutes),m.location,p_points,1,p_level,m.id) returning id into duty;
 update public.matches set club_referee=true where id=m.id;
 return duty;
end;
$$;
-- Manual cancellation must not be undone by a later Nevobo reinstatement.
create or replace function public.cancel_duty(p_duty uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 update public.duties set cancelled=true,nevobo_cancelled=false where id=p_duty;
 if not found then raise exception 'Dienst niet gevonden.';end if;
 insert into public.audit_log(actor_id,action,entity_id) values(auth.uid(),'cancel_duty',p_duty);
end;
$$;

create or replace function public.claim_notification_emails(p_limit integer default 10)
returns table(outbox_id uuid,claim uuid,recipient text,subject text,body text,notification_id uuid)
language plpgsql security definer set search_path='' as $$
begin
 update public.notification_email_outbox set state='failed',last_error_code='delivery_lease_expired',locked_until=null,claim_token=null where state='processing' and locked_until<now() and attempts>=10;
 return query with candidates as (
  select o.id from public.notification_email_outbox o where o.attempts<10 and
   ((o.state='pending' and o.available_at<=now()) or (o.state='processing' and o.locked_until<now()))
  order by o.available_at limit greatest(1,least(p_limit,20)) for update skip locked
 ), claimed as (
  update public.notification_email_outbox o set state='processing',attempts=attempts+1,claim_token=gen_random_uuid(),locked_until=now()+interval '2 minutes'
  from candidates c where o.id=c.id returning o.*
 ) select c.id,c.claim_token,p.email,n.title,n.body,n.id from claimed c join public.notifications n on n.id=c.notification_id join public.profiles p on p.id=n.member_id;
end;
$$;
create or replace function public.finish_notification_email(p_outbox uuid,p_claim uuid,p_sent boolean,p_provider text default null,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.notification_email_outbox set state=case when p_sent then 'sent' when attempts>=10 then 'failed' else 'pending' end,
 sent_at=case when p_sent then now() else null end,provider_id=case when p_sent then left(p_provider,200) else null end,
 last_error_code=case when p_sent then null else left(p_error,100) end,
 available_at=now()+make_interval(secs=>least(14400,power(2,least(attempts,8))::int*60)),locked_until=null,claim_token=null
 where id=p_outbox and state='processing' and claim_token=p_claim;
end;
$$;
revoke all on function public.nevobo_match_state(public.matches),public.acquire_nevobo_sync(),public.fail_nevobo_sync(uuid,text),public.apply_nevobo_snapshot(uuid,uuid,jsonb,timestamptz,boolean),public.claim_notification_emails(integer),public.finish_notification_email(uuid,uuid,boolean,text,text),public.guard_match_enrollment() from public,anon,authenticated;
grant execute on function public.acquire_nevobo_sync(),public.fail_nevobo_sync(uuid,text),public.apply_nevobo_snapshot(uuid,uuid,jsonb,timestamptz,boolean),public.claim_notification_emails(integer),public.finish_notification_email(uuid,uuid,boolean,text,text) to service_role;
revoke all on function public.mark_notification_read(uuid),public.create_match_referee_duty(uuid,numeric,integer,integer) from public,anon;
grant execute on function public.mark_notification_read(uuid),public.create_match_referee_duty(uuid,numeric,integer,integer) to authenticated;
commit;
