-- Functions and function groups award a fixed credit for one season.
-- Existing free-form awards remain untouched. Apply after 001.
begin;
create table if not exists public.function_groups (
 id uuid primary key default gen_random_uuid(),
 season_id uuid not null references public.seasons(id),
 title text not null check(length(btrim(title)) between 1 and 200),
 points numeric(8,2) not null check(points>=0 and points<=999999.99),
 unique(season_id,title),unique(id,season_id)
);
alter table public.function_groups enable row level security;
drop policy if exists function_groups_read on public.function_groups;
create policy function_groups_read on public.function_groups for select to authenticated using(true);
revoke all on public.function_groups from public,anon,authenticated;
grant select on public.function_groups to authenticated;
create unique index if not exists function_definitions_id_season_key on public.function_definitions(id,season_id);
alter table public.function_assignments add column if not exists definition_id uuid;
alter table public.function_assignments add column if not exists group_id uuid;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.function_assignments'::regclass and conname='assignment_one_function_source') then
  alter table public.function_assignments add constraint assignment_one_function_source check(num_nonnulls(definition_id,group_id)<=1);
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.function_assignments'::regclass and conname='assignment_definition_season_fk') then
  alter table public.function_assignments add constraint assignment_definition_season_fk foreign key(definition_id,season_id) references public.function_definitions(id,season_id);
 end if;
 if not exists(select 1 from pg_constraint where conrelid='public.function_assignments'::regclass and conname='assignment_group_season_fk') then
  alter table public.function_assignments add constraint assignment_group_season_fk foreign key(group_id,season_id) references public.function_groups(id,season_id);
 end if;
end;$$;
create unique index if not exists one_member_function on public.function_assignments(member_id,definition_id) where definition_id is not null;
create unique index if not exists one_member_function_group on public.function_assignments(member_id,group_id) where group_id is not null;

create index if not exists function_assignment_groups on public.function_assignments(group_id,season_id) where group_id is not null;
create index if not exists function_assignment_definitions on public.function_assignments(definition_id,season_id) where definition_id is not null;

create or replace function public.guard_season_function_credit() returns trigger
language plpgsql security definer set search_path='' as $$
declare source_season uuid;source_title text;source_points numeric;s public.seasons;
begin
 if new.definition_id is null and new.group_id is null then return new;end if;
 if new.definition_id is not null and new.group_id is not null then raise exception 'Kies een functie of een functiegroep.';end if;
 if new.definition_id is not null then
  select season_id,title,points into source_season,source_title,source_points from public.function_definitions where id=new.definition_id for share;
 else
  select season_id,title,points into source_season,source_title,source_points from public.function_groups where id=new.group_id for share;
 end if;
 if not found or source_season is distinct from new.season_id then raise exception 'Kies een functie of functiegroep uit hetzelfde seizoen.';end if;
 select * into s from public.seasons where id=new.season_id;
 if tg_op='INSERT' or new.member_id is distinct from old.member_id or new.season_id is distinct from old.season_id then
  if not exists(select 1 from public.memberships where member_id=new.member_id and season_id=new.season_id) then raise exception 'Dit lid heeft geen team in het seizoen.';end if;
 end if;
 new.title:=source_title;new.points:=source_points;new.starts_on:=s.starts_on;new.ends_on:=s.ends_on;
 return new;
end;$$;
drop trigger if exists guard_season_function_credit on public.function_assignments;
create trigger guard_season_function_credit before insert or update on public.function_assignments for each row execute function public.guard_season_function_credit();
create or replace function public.refresh_season_function_credit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='function_groups' then
  update public.function_assignments set title=new.title,points=new.points where group_id=new.id;
 else
  update public.function_assignments set title=new.title,points=new.points where definition_id=new.id;
 end if;
 return new;
end;$$;
drop trigger if exists refresh_group_credit on public.function_groups;
create trigger refresh_group_credit after update of title,points on public.function_groups for each row when(old.title is distinct from new.title or old.points is distinct from new.points) execute function public.refresh_season_function_credit();
drop trigger if exists refresh_function_credit on public.function_definitions;
create trigger refresh_function_credit after update of title,points on public.function_definitions for each row when(old.title is distinct from new.title or old.points is distinct from new.points) execute function public.refresh_season_function_credit();

create or replace function public.save_season_function(p_season uuid,p_id uuid,p_title text,p_points numeric,p_group boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;old_value jsonb;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_points is null or p_points<0 or p_points>999999.99 then raise exception 'Controleer naam en punten.';end if;
 perform 1 from public.seasons where id=p_season for share;
 if not found then raise exception 'Seizoen niet gevonden.';end if;
 if p_group then
  if p_id is null then
   insert into public.function_groups(season_id,title,points) values(p_season,btrim(p_title),p_points) returning id into result;
  else
   select to_jsonb(g) into old_value from public.function_groups g where id=p_id and season_id=p_season for update;
   if not found then raise exception 'Functiegroep niet gevonden in dit seizoen.';end if;
   update public.function_groups set title=btrim(p_title),points=p_points where id=p_id returning id into result;
  end if;
 else
  if p_id is null then
   insert into public.function_definitions(season_id,title,points) values(p_season,btrim(p_title),p_points) returning id into result;
  else
   select to_jsonb(d) into old_value from public.function_definitions d where id=p_id and season_id=p_season for update;
   if not found then raise exception 'Functie niet gevonden in dit seizoen.';end if;
   update public.function_definitions set title=btrim(p_title),points=p_points where id=p_id returning id into result;
  end if;
 end if;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),case when p_group then 'save_function_group' else 'save_season_function' end,result,jsonb_build_object('season_id',p_season,'previous',old_value,'title',btrim(p_title),'points',p_points));
 return result;
end;$$;
create or replace function public.assign_season_function(p_member uuid,p_season uuid,p_kind text,p_choice uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;source_title text;source_points numeric;s public.seasons;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 select * into s from public.seasons where id=p_season for share;
 if not found then raise exception 'Seizoen niet gevonden.';end if;
 if p_kind='function' then
  select title,points into source_title,source_points from public.function_definitions where id=p_choice and season_id=p_season for share;
 elsif p_kind='group' then
  select title,points into source_title,source_points from public.function_groups where id=p_choice and season_id=p_season for share;
 else raise exception 'Kies een functie of functiegroep.';
 end if;
 if not found then raise exception 'Functie of functiegroep niet gevonden in dit seizoen.';end if;
 if not exists(select 1 from public.memberships where member_id=p_member and season_id=p_season) then raise exception 'Dit lid heeft geen team in het seizoen.';end if;
 insert into public.function_assignments(member_id,season_id,title,points,starts_on,ends_on,definition_id,group_id)
 values(p_member,p_season,source_title,source_points,s.starts_on,s.ends_on,case when p_kind='function' then p_choice end,case when p_kind='group' then p_choice end)
 on conflict do nothing returning id into result;
 if result is null then
  select id into result from public.function_assignments where member_id=p_member and season_id=p_season and (case when p_kind='function' then definition_id=p_choice else group_id=p_choice end);
 else
  insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'assign_season_function',result,jsonb_build_object('member_id',p_member,'season_id',p_season,'kind',p_kind,'choice_id',p_choice,'points',source_points));
 end if;
 return result;
end;$$;
create or replace function public.add_function_group_members(p_group uuid,p_members uuid[]) returns void
language plpgsql security definer set search_path='' as $$
declare season uuid;member uuid;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_members is null or cardinality(p_members) not between 1 and 1000 then raise exception 'Kies één of meer leden (maximaal 1000).';end if;
 select season_id into season from public.function_groups where id=p_group;
 if not found then raise exception 'Functiegroep niet gevonden.';end if;
 for member in select distinct unnest(p_members) loop
  perform public.assign_season_function(member,season,'group',p_group);
 end loop;
end;$$;
create or replace function public.remove_function(p_assignment uuid) returns void
language plpgsql security definer set search_path='' as $$
declare previous public.function_assignments;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 delete from public.function_assignments where id=p_assignment returning * into previous;
 if not found then raise exception 'Toekenning niet gevonden.';end if;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'remove_function',p_assignment,to_jsonb(previous));
end;$$;
revoke all on function public.guard_season_function_credit(),public.refresh_season_function_credit() from public,anon,authenticated;
revoke all on function public.save_season_function(uuid,uuid,text,numeric,boolean),public.assign_season_function(uuid,uuid,text,uuid),public.add_function_group_members(uuid,uuid[]) from public,anon;
grant execute on function public.save_season_function(uuid,uuid,text,numeric,boolean),public.assign_season_function(uuid,uuid,text,uuid),public.add_function_group_members(uuid,uuid[]) to authenticated;
notify pgrst,'reload schema';
commit;
