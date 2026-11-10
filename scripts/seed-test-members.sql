-- Explicitly requested test data, run manually in the Supabase SQL Editor.
-- Requires 001 + 005 and an active season with teams. Not a migration.
-- Existing members, passwords, enrollments, points and team reservations stay intact.
-- Optional: configure avv.test_member_password in this SQL session before running
-- this file to give NEW test users a shared test password (minimum 12 characters).
-- Without that setting the users are confirmed, but have no password login yet.
-- Do not commit or share a password. This script sends no invitation/confirmation mail.
begin;
lock table public.seasons,public.teams,public.memberships,public.profiles,
 auth.users,auth.identities in share row exclusive mode;
do $seed$
declare
 seed_source constant text := 'keistad-test-members-v1';
 season uuid; t record; member_count integer; target_count integer; captain_count integer;
 slot integer; member_digest text; member_uuid uuid; member_email text; member_code text; captain_uuid uuid;
 first_name text; last_name text; qualification text; levels text[];
 added integer := 0; name_counter integer; code_counter integer;
 password_input text := nullif(current_setting('avv.test_member_password',true),'');
 password_hash text := ''; crypto_schema text;
 first_names constant text[] := array['Mila','Daan','Noor','Finn','Tess','Sem','Lotte','Luuk','Fenna','Bram','Evi','Mees','Lina','Jens','Roos','Niek','Yara','Thijs','Saar','Joep','Nora','Tijn','Isa','Cas','Elin','Siem','Liv','Pim','Sofie','Mats','Anna','Teun','Maud','Noud','Eva','Stijn','Fleur','Jurre','Lieke','Boaz','Nina','Gijs','Sara','Ruben','Lena','Tobias','Jasmijn','Morris'];
 last_names constant text[] := array['van de Linden','Bosveld','de Winter','van Dalen','Veldman','Bergkamp','de Bruin','van Beek','Hoogland','van der Meer','Kooistra','Meijerink','de Vos','Westerveld','van Es','Molenaar','Verhoeven','Buitenhuis','van Doorn','Dekkers','Scholten','Groenveld','van Leeuwen','Westerhof','de Graaf','Hofman','van Zanten','Lammers','Rietveld','van Vliet','Boomsma','van den Berg','van Rijn','Wolters','Evers','van Houten','Bakker','van Os','Smit','van Gelder','Veldhuizen','van Kooten','van der Laan','Zuidema','Kramer','van Ginkel','Wessels','Noordman'];
begin
 select id into season from public.seasons where active;
 if season is null then raise exception 'Stel eerst een actief seizoen in.';end if;
 if not exists(select 1 from public.teams where season_id=season) then raise exception 'Het actieve seizoen heeft nog geen teams.';end if;
 if to_regprocedure('public.referee_qualification_rank(text)') is null then raise exception 'Voer eerst migratie 005_referee_qualifications.sql uit.';end if;
 if password_input is not null then
  if length(password_input)<12 then raise exception 'Gebruik een testwachtwoord van minimaal 12 tekens.';end if;
  select n.nspname into crypto_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pgcrypto';
  if crypto_schema is null then raise exception 'Voor een testwachtwoord is de Supabase-extensie pgcrypto nodig.';end if;
  execute format('select %I.crypt($1,%I.gen_salt(''bf'',10))',crypto_schema,crypto_schema) into password_hash using password_input;
 end if;
 -- Refuse ambiguous existing rosters instead of removing members/captains.
 if exists(select 1 from public.memberships m where m.season_id=season group by m.team_id having count(*)>12) then
  raise exception 'Een team heeft al meer dan 12 leden. Er worden geen bestaande leden verwijderd.';
 end if;
 if exists(select 1 from public.memberships m where m.season_id=season group by m.team_id having count(*) filter(where m.captain)>1) then
  raise exception 'Een team heeft al meerdere aanvoerders. Los die dubbele toewijzing eerst op.';
 end if;
 select coalesce(max(substring(nevobo_code from 5)::integer),0) into code_counter from public.profiles where nevobo_code ~ '^TEST[0-9]{6}$';
 select count(*)::integer into name_counter from auth.users where raw_user_meta_data->>'seed_source'=seed_source;
 for t in select id,name from public.teams where season_id=season order by name,id loop
  select count(*)::integer into member_count from public.memberships where team_id=t.id and season_id=season;
  -- Stable 8..12 target for this team; rerunning never grows unchanged rosters.
  target_count:=greatest(member_count,8+(('x'||substr(md5(t.id::text),1,8))::bit(32)::bigint%5)::integer);
  select array_agg(code order by random()) into levels from unnest(array['V6','V4','R2.2','R2','R1','N3','N2','N1']) as code;
  slot:=0;
  while member_count<target_count loop
   slot:=slot+1;
   if slot>10000 then raise exception 'Geen vrije testlidplaats gevonden voor team %.',t.name;end if;
   member_digest:=md5(seed_source||':'||season::text||':'||t.id::text||':'||slot::text);
   member_uuid:=(substr(member_digest,1,8)||'-'||substr(member_digest,9,4)||'-4'||substr(member_digest,14,3)||'-8'||substr(member_digest,18,3)||'-'||substr(member_digest,21,12))::uuid;
   member_email:='testlid-'||replace(t.id::text,'-','')||'-'||slot::text||'@example.test';
   if exists(select 1 from auth.users where id=member_uuid) then
    if not exists(select 1 from auth.users where id=member_uuid and raw_user_meta_data->>'seed_source'=seed_source and lower(email)=member_email) then
     raise exception 'Test-ID bestaat al buiten deze testdataset. Er is niets overschreven.';
    end if;
    continue; -- Preserve existing/moved test accounts and their credentials.
   end if;
   if exists(select 1 from auth.users where lower(email)=member_email) or exists(select 1 from public.profiles where lower(email)=member_email) then
    raise exception 'Test-e-mailadres bestaat al. Er is niets overschreven.';
   end if;
   code_counter:=code_counter+1;name_counter:=name_counter+1;
   if code_counter>999999 then raise exception 'Geen vrije TEST-Nevobo-code beschikbaar.';end if;
   member_code:='TEST'||lpad(code_counter::text,6,'0');
   first_name:=first_names[1+(name_counter-1)%array_length(first_names,1)];
   last_name:=last_names[1+((name_counter-1)/array_length(first_names,1))%array_length(last_names,1)];
   qualification:=levels[1+(slot-1)%8];
   insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,email_change,email_change_token_new,recovery_token,email_change_token_current,reauthentication_token,phone_change,phone_change_token)
   values('00000000-0000-0000-0000-000000000000',member_uuid,'authenticated','authenticated',member_email,password_hash,now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email')),
    jsonb_build_object('first_name',first_name,'last_name',last_name,'email_verified',true,'test_member',true,'seed_source',seed_source,'seed_season_id',season,'seed_team_id',t.id,'seed_slot',slot),
    now(),now(),'','','','','','','','');
   -- The existing on_auth_user_created trigger creates the actual app profile.
   if not exists(select 1 from public.profiles where id=member_uuid) then raise exception 'De profieltrigger ontbreekt. Testimport teruggedraaid.';end if;
   insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at)
   values(gen_random_uuid(),member_uuid,member_uuid::text,jsonb_build_object('sub',member_uuid::text,'email',member_email,'email_verified',true),'email',now(),now());
   update public.profiles set nevobo_code=member_code,referee_qualification=qualification,
    referee_level=public.referee_qualification_rank(qualification) where id=member_uuid;
   insert into public.memberships(member_id,season_id,team_id) values(member_uuid,season,t.id);
   member_count:=member_count+1;added:=added+1;
  end loop;
  select count(*)::integer into captain_count from public.memberships where team_id=t.id and season_id=season and captain;
  if captain_count=0 then
   select m.member_id into captain_uuid from public.memberships m join auth.users u on u.id=m.member_id
   where m.team_id=t.id and m.season_id=season
   order by (u.raw_user_meta_data->>'seed_source'=seed_source) desc nulls last,m.member_id limit 1;
   update public.memberships set captain=true where member_id=captain_uuid and season_id=season;
  end if;
 end loop;
 if password_input is not null then perform set_config('avv.test_member_password','',false);end if;
 insert into public.audit_log(actor_id,action,entity_id,details)
 values(null,'seed_test_members',season,jsonb_build_object('source',seed_source,'added',added,'email_domain','example.test'));
end;
$seed$;
commit;
-- Summary contains no passwords or authentication tokens.
select t.name as team,count(m.member_id) as leden,
 count(*) filter(where u.raw_user_meta_data->>'seed_source'='keistad-test-members-v1') as testleden,
 count(*) filter(where m.captain) as aanvoerders,
 max(p.first_name||' '||p.last_name) filter(where m.captain) as aanvoerder,
 max(p.email) filter(where m.captain) as aanvoerder_email
from public.teams t join public.seasons s on s.id=t.season_id and s.active
left join public.memberships m on m.team_id=t.id and m.season_id=t.season_id
left join public.profiles p on p.id=m.member_id
left join auth.users u on u.id=m.member_id
group by t.id,t.name order by t.name;
