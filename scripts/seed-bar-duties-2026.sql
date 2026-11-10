-- Requested bar schedule: Tuesday, Thursday, Friday and Saturday through 2026.
-- Run in the app's Supabase SQL Editor. Requires an active season covering
-- the requested days. Repeating preserves existing duties and enrollments.
begin;
lock table public.duties in share row exclusive mode;
do $seed$
declare s public.seasons; slot record; duty_start timestamptz; duty_end timestamptz; duty_id uuid; hex text; inserted_count integer:=0; skipped_count integer:=0;
 seed_source constant text:='keistad-bar-schedule-2026-v1';
begin
 select * into s from public.seasons where active for share;
 if not found then raise exception 'Stel eerst een actief seizoen in.';end if;
 if s.starts_on>'2026-11-10'::date or s.ends_on<'2026-12-31'::date then raise exception 'Het actieve seizoen moet 10 november t/m 31 december 2026 omvatten.';end if;
 for slot in
  select d::date as day, t.* from generate_series('2026-11-10'::date,'2026-12-31'::date,interval '1 day') d
  cross join (values
   (2,1,'18:30'::time,'20:30'::time,2,'avond',false),
   (2,2,'20:30'::time,'22:00'::time,1,'late avond',true),
   (4,1,'18:00'::time,'20:00'::time,2,'avond',false),
   (4,2,'20:00'::time,'22:30'::time,2,'late avond',false),
   (5,1,'18:30'::time,'21:00'::time,3,'avond',false),
   (5,2,'21:00'::time,'23:30'::time,2,'late avond',false),
   (6,1,'08:30'::time,'11:00'::time,2,'ochtend',false),
   (6,2,'11:00'::time,'14:00'::time,3,'middag',false),
   (6,3,'14:00'::time,'17:00'::time,2,'middag',false),
   (6,4,'17:00'::time,'20:00'::time,2,'avond',true)
  ) t(weekday,slot_number,start_local,end_local,capacity,label,alternate)
  where extract(isodow from d)=t.weekday and (not t.alternate or extract(week from d)::integer%2=1)
  order by d,t.slot_number
 loop
  duty_start:=(slot.day+slot.start_local) at time zone 'Europe/Amsterdam';
  duty_end:=(slot.day+slot.end_local) at time zone 'Europe/Amsterdam';
  if duty_start<=now() then continue;end if;
  hex:=md5(seed_source||s.id::text||slot.day::text||slot.slot_number::text);
  duty_id:=overlay(overlay(hex placing '4' from 13 for 1) placing '8' from 17 for 1)::uuid;
  if exists(select 1 from public.duties where id=duty_id or (season_id=s.id and kind='bar' and starts_at=duty_start and ends_at=duty_end and location='Sportcomplex Amerena')) then skipped_count:=skipped_count+1;continue;end if;
  insert into public.duties(id,season_id,title,kind,starts_at,ends_at,location,points,capacity,required_level)
   values(duty_id,s.id,'Bardienst · '||slot.label,'bar',duty_start,duty_end,'Sportcomplex Amerena',extract(epoch from duty_end-duty_start)/3600,slot.capacity,0);
  inserted_count:=inserted_count+1;
 end loop;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'seed_bar_duties_2026',s.id,jsonb_build_object('source',seed_source,'created',inserted_count,'skipped',skipped_count));
 raise notice '% bardiensten aangemaakt; % bestaande diensten overgeslagen.',inserted_count,skipped_count;
end $seed$;
commit;

-- Result visible in the SQL Editor, including on a repeat run.
select (details->>'created')::integer as aangemaakt,
       (details->>'skipped')::integer as bestaande_diensten_overgeslagen
from public.audit_log
where action='seed_bar_duties_2026'
 and entity_id=(select id from public.seasons where active)
order by created_at desc,id desc
limit 1;
