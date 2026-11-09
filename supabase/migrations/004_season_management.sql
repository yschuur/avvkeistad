-- Explicit season creation, editing and activation. Existing IDs/data are kept.
begin;
alter table public.seasons add column if not exists updated_at timestamptz not null default clock_timestamp();

create or replace function public.save_season(
 p_season uuid,p_name text,p_start date,p_end date,p_norm numeric,p_youth numeric,p_senior numeric,
 p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.seasons;saved public.seasons;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 -- Serialize create/activate operations, including the first active season.
 perform pg_advisory_xact_lock(184721,1);
 if p_name is null or length(btrim(p_name)) not between 1 and 120 then raise exception 'Vul een seizoensnaam van maximaal 120 tekens in.';end if;
 if p_start is null or p_end is null or p_end<p_start then raise exception 'Controleer de begin- en einddatum.';end if;
 if p_norm is null or p_norm<0 or p_norm>999999.99 or p_norm<>round(p_norm,2)
  or p_youth<0 or p_youth>999999.99 or p_youth<>round(p_youth,2)
  or p_senior<0 or p_senior>999999.99 or p_senior<>round(p_senior,2)
  or p_norm::text in ('NaN','Infinity','-Infinity') or p_youth::text in ('NaN','Infinity','-Infinity') or p_senior::text in ('NaN','Infinity','-Infinity')
 then raise exception 'Gebruik puntennormen tussen 0 en 999999,99 met maximaal twee decimalen.';end if;
 if exists(select 1 from public.seasons where lower(btrim(name))=lower(btrim(p_name)) and (p_season is null or id<>p_season))
 then raise exception 'Er bestaat al een seizoen met deze naam.';end if;
 if p_season is null then
  insert into public.seasons(name,starts_on,ends_on,default_norm,youth_norm,senior_norm,active)
  values(btrim(p_name),p_start,p_end,p_norm,p_youth,p_senior,not exists(select 1 from public.seasons where active)) returning * into saved;
 else
  select * into previous from public.seasons where id=p_season for update;
  if not found then raise exception 'Dit seizoen bestaat niet meer. Herlaad de pagina.';end if;
  if p_expected_updated_at is null or p_expected_updated_at<>previous.updated_at then
   raise exception 'Dit seizoen is intussen gewijzigd. Herlaad de pagina voordat je opnieuw opslaat.';
  end if;
  if (p_start,p_end) is distinct from (previous.starts_on,previous.ends_on) and (
   exists(select 1 from public.duties where season_id=p_season and not cancelled
    and ((starts_at at time zone 'Europe/Amsterdam')::date<p_start or (ends_at at time zone 'Europe/Amsterdam')>(p_end+1)::timestamp))
   or exists(select 1 from public.matches where season_id=p_season and not cancelled
    and ((starts_at at time zone 'Europe/Amsterdam')::date<p_start or (starts_at at time zone 'Europe/Amsterdam')::date>p_end))
   or exists(select 1 from public.function_assignments where season_id=p_season and (starts_on<p_start or ends_on>p_end))
  ) then raise exception 'De periode sluit bestaande diensten, wedstrijden of functietoekenningen uit. Kies datums waar deze binnen vallen.';end if;
  update public.seasons set name=btrim(p_name),starts_on=p_start,ends_on=p_end,
   default_norm=p_norm,youth_norm=p_youth,senior_norm=p_senior,updated_at=clock_timestamp()
   where id=p_season returning * into saved;
 end if;
 insert into public.audit_log(actor_id,action,entity_id,details)
 values(auth.uid(),case when p_season is null then 'create_season' else 'update_season' end,saved.id,jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(saved)));
 return saved.id;
end;
$$;

create or replace function public.activate_season(p_season uuid,p_expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare target public.seasons;previous uuid;
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 perform pg_advisory_xact_lock(184721,1);
 select * into target from public.seasons where id=p_season for update;
 if not found then raise exception 'Dit seizoen bestaat niet meer. Herlaad de pagina.';end if;
 if p_expected_updated_at is null or p_expected_updated_at<>target.updated_at then
  raise exception 'Dit seizoen is intussen gewijzigd. Herlaad de pagina voordat je het activeert.';
 end if;
 if target.active then return;end if;
 select id into previous from public.seasons where active;
 update public.seasons set active=false,updated_at=clock_timestamp() where active;
 update public.seasons set active=true,updated_at=clock_timestamp() where id=p_season;
 insert into public.audit_log(actor_id,action,entity_id,details) values(auth.uid(),'activate_season',p_season,jsonb_build_object('previous_season_id',previous));
end;
$$;

-- An old open form has no season ID/version. Refuse its implicit write to
-- whichever season happens to be active; direct the manager to the new screen.
create or replace function public.setup_season(p_name text,p_start date,p_end date,p_norm numeric,p_youth numeric,p_senior numeric) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 raise exception 'Het seizoensbeheer is vernieuwd. Herlaad de app en open Beheer > Seizoenen.';
end;
$$;
revoke all on function public.save_season(uuid,text,date,date,numeric,numeric,numeric,timestamptz),public.activate_season(uuid,timestamptz) from public,anon;
grant execute on function public.save_season(uuid,text,date,date,numeric,numeric,numeric,timestamptz),public.activate_season(uuid,timestamptz) to authenticated;
commit;
