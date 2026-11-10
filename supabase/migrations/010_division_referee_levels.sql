-- Apply after 006. No changes to club duties: promotion class and above
-- still use externally assigned referees. Historical enrollments stay intact.
begin;
create or replace function public.team_referee_requirement(p_age text,p_competition text) returns text
language sql immutable set search_path='' as $$
 select case when p_competition in ('Superdivisie','Topdivisie','Eerste divisie','Tweede divisie') then 'N2'
 when p_competition='Derde divisie' then 'R1'
 when p_competition='Promotieklasse' then 'R2'
 when (p_age='senior' and p_competition in ('Eerste klasse','Tweede klasse')) or (p_age='youth' and p_competition='Hoofdklasse') then 'V4'
 else 'V6' end;
$$;
notify pgrst, 'reload schema';
commit;
