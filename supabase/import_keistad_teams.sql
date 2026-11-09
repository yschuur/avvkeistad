-- One-time replacement of CURRENT/ACTIVE season teams using the user-supplied
-- Keistad-teams.xlsx. Requires migrations 003, 005 and 006. Run in SQL Editor.
-- Other seasons and completed duties/points are not deleted.
-- Old team IDs, memberships and duty reservations are backed up in audit_log.
-- Recognized teams keep their members/captains/norm overrides and reservations
-- via an explicit old-to-new ID mapping. Unmapped references ABORT everything.
-- XLSX SHA256: 6cabdb46018fa757b49f43dbcae01b34afc89107cfdd842624bb98a6dd1d1040
begin;
lock table public.seasons,public.teams,public.memberships,public.duties,public.enrollments in share row exclusive mode;
create temporary table keistad_import_input(name text primary key,competition_level text,age_class text,new_id uuid default gen_random_uuid()) on commit drop;
insert into keistad_import_input(name,competition_level,age_class) values
 ('AVV Keistad HS 1','Superdivisie','senior'),
 ('AVV Keistad HS 2','Eerste divisie','senior'),
 ('AVV Keistad HS 3','Promotieklasse','senior'),
 ('AVV Keistad HS 4','Eerste klasse','senior'),
 ('AVV Keistad HS 5','Eerste klasse','senior'),
 ('AVV Keistad HS 6','Tweede klasse','senior'),
 ('AVV Keistad HS 7','Derde klasse','senior'),
 ('AVV Keistad DS 1','Superdivisie','senior'),
 ('Proglass/AVV Keistad DS 2','Topdivisie','senior'),
 ('AVV Keistad DS 3','Promotieklasse','senior'),
 ('AVV Keistad DS 4','Eerste klasse','senior'),
 ('AVV Keistad DS 5','Eerste klasse','senior'),
 ('AVV Keistad DS 6','Tweede klasse','senior'),
 ('AVV Keistad DS 7','Tweede klasse','senior'),
 ('AVV Keistad DS 8','Derde klasse','senior'),
 ('AVV Keistad DS 9','Vierde klasse','senior'),
 ('AVV Keistad JA 1','Hoofdklasse','youth'),
 ('AVV Keistad JB 1','Hoofdklasse','youth'),
 ('AVV Keistad JB 2','Tweede klasse','youth'),
 ('AVV Keistad JC 1','Eerste klasse','youth'),
 ('AVV Keistad MA 1','Hoofdklasse','youth'),
 ('AVV Keistad MA 2','Eerste klasse','youth'),
 ('AVV Keistad MA 3','Eerste klasse','youth'),
 ('AVV Keistad MA 4','Tweede klasse','youth'),
 ('AVV Keistad MA 5','Derde klasse','youth'),
 ('AVV Keistad MB 1','Hoofdklasse','youth'),
 ('AVV Keistad MB 2','Eerste klasse','youth'),
 ('AVV Keistad MB 3','Eerste klasse','youth'),
 ('AVV Keistad MB 4','Tweede klasse','youth'),
 ('AVV Keistad MB 5','Derde klasse','youth'),
 ('AVV Keistad MB 6','Derde klasse','youth'),
 ('AVV Keistad MC 1','Tweede klasse','youth'),
 ('AVV Keistad MC 2','Derde klasse','youth'),
 ('AVV Keistad MC 3','Derde klasse','youth'),
 ('AVV Keistad L2 1',null,'youth'),
 ('AVV Keistad L2 2',null,'youth'),
 ('AVV Keistad L2 3',null,'youth'),
 ('AVV Keistad L2 4',null,'youth'),
 ('AVV Keistad L2 5',null,'youth'),
 ('AVV Keistad L3 1',null,'youth'),
 ('AVV Keistad L3 2',null,'youth'),
 ('AVV Keistad L3 3',null,'youth'),
 ('AVV Keistad L3 4',null,'youth'),
 ('AVV Keistad L3 5',null,'youth'),
 ('AVV Keistad L3 6',null,'youth'),
 ('AVV Keistad L3 7',null,'youth'),
 ('AVV Keistad L3 8',null,'youth'),
 ('AVV Keistad L4 1',null,'youth'),
 ('AVV Keistad L4 2',null,'youth'),
 ('AVV Keistad L4 3',null,'youth'),
 ('AVV Keistad L5 1',null,'youth'),
 ('AVV Keistad L5 2',null,'youth'),
 ('AVV Keistad L5 3',null,'youth'),
 ('AVV Keistad L5 4',null,'youth'),
 ('AVV Keistad XZ 1',null,'senior'),
 ('AVV Keistad XZ 2',null,'senior'),
 ('AVV Keistad XZ 3',null,'senior');
do $$
declare season uuid;unmapped text;old_teams jsonb;old_memberships jsonb;old_reservations jsonb;
begin
 select id into season from public.seasons where active for update;
 if season is null then raise exception 'Maak of activeer eerst het seizoen waarvoor de Excel-teams bedoeld zijn.';end if;
 select string_agg(t.name,', ' order by t.name) into unmapped from public.teams t
 where t.season_id=season and not exists(select 1 from keistad_import_input i where public.keistad_team_key(i.name)=public.keistad_team_key(t.name))
 and (exists(select 1 from public.memberships m where m.team_id=t.id) or exists(select 1 from public.duties d where d.assigned_team_id=t.id));
 if unmapped is not null then raise exception 'Teams met bestaande koppelingen konden niet worden herkend: %. Hernoem deze naar de juiste Excel-teamnaam en voer dit script opnieuw uit. Er is niets verwijderd.',unmapped;end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into old_teams from public.teams t where t.season_id=season;
 select coalesce(jsonb_agg(to_jsonb(m)),'[]') into old_memberships from public.memberships m where m.season_id=season;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'assigned_team_id',d.assigned_team_id)),'[]') into old_reservations from public.duties d where d.season_id=season and d.assigned_team_id is not null;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'replace_teams_from_excel',season,jsonb_build_object('source','Keistad-teams.xlsx','teams',old_teams,'memberships',old_memberships,'duty_reservations',old_reservations,'new_count',57));
 -- Refresh only AFTER the complete replacement; never during a partial list.
 drop trigger if exists refresh_changed_team_requirements on public.teams;
 insert into public.teams(id,season_id,name,age_class,competition_level)
 select new_id,season,'__keistad_import_'||new_id::text,age_class,competition_level from keistad_import_input;
 update public.memberships m set team_id=i.new_id from public.teams t,keistad_import_input i
 where m.season_id=season and m.team_id=t.id and t.season_id=season and public.keistad_team_key(t.name)=public.keistad_team_key(i.name);
 update public.duties d set assigned_team_id=i.new_id from public.teams t,keistad_import_input i
 where d.season_id=season and d.assigned_team_id=t.id and t.season_id=season and public.keistad_team_key(t.name)=public.keistad_team_key(i.name);
 delete from public.teams t where t.season_id=season and not exists(select 1 from keistad_import_input i where i.new_id=t.id);
 update public.teams t set name=i.name from keistad_import_input i where t.id=i.new_id;
 create trigger refresh_changed_team_requirements after insert or delete or update of name,age_class,competition_level,season_id on public.teams for each row execute function public.refresh_changed_team_requirements();
 perform public.refresh_match_referee_requirements(season);
 if (select count(*) from public.teams where season_id=season)<>57 then raise exception 'Teamimport niet volledig; alles teruggedraaid.';end if;
end;
$$;
commit;
-- Verify the actual imported list and derived minimum after committing.
select t.name,t.competition_level,case when t.age_class='youth' then 'Jeugd' else 'Senioren' end as categorie,
 public.team_referee_requirement(t.age_class,t.competition_level) as niveaugrens,
 public.referee_qualification_rank(public.team_referee_requirement(t.age_class,t.competition_level))<public.referee_qualification_rank('R2') as clubscheidsrechter_nodig
from public.teams t join public.seasons s on s.id=t.season_id where s.active order by t.age_class,t.name;
