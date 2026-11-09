-- Club identity and independent accent colour. Safe after 001, with or without
-- 002. Existing colours, application data and authorizations are preserved.
begin;
create table if not exists public.club_branding (
 id boolean primary key default true check(id),
 primary_color text not null default '#087D56' check(length(primary_color)=7 and primary_color ~ '^#[0-9A-Fa-f]{6}$'),
 secondary_color text not null default '#6483B8' check(length(secondary_color)=7 and secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
 updated_at timestamptz not null default now(),updated_by uuid references public.profiles(id) on delete set null
);
alter table public.club_branding add column if not exists club_id uuid not null default gen_random_uuid();
alter table public.club_branding add column if not exists club_name text not null default 'AVV Keistad'
 check(length(trim(club_name)) between 2 and 80 and club_name !~ '[[:cntrl:]]');
alter table public.club_branding add column if not exists accent_color text;
update public.club_branding set accent_color=primary_color where accent_color is null;
alter table public.club_branding alter column accent_color set default '#087D56';
alter table public.club_branding alter column accent_color set not null;
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.club_branding'::regclass and conname='club_branding_accent_color_check') then
  alter table public.club_branding add constraint club_branding_accent_color_check check(length(accent_color)=7 and accent_color ~ '^#[0-9A-Fa-f]{6}$');
 end if;
end;$$;
create or replace function public.valid_club_logo(p_data text) returns boolean
language plpgsql immutable set search_path='' as $$
declare bytes bytea;format text;
begin
 if p_data is null then return true;end if;
 if length(p_data)>350000 or p_data !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$' then return false;end if;
 format:=split_part(split_part(p_data,';',1),'/',2);
 bytes:=decode(split_part(p_data,',',2),'base64');
 if octet_length(bytes)>262144 or octet_length(bytes)<16 then return false;end if;
 return case format when 'png' then substring(bytes from 1 for 8)=decode('89504e470d0a1a0a','hex') and substring(bytes from 13 for 4)=decode('49484452','hex')
 when 'jpeg' then substring(bytes from 1 for 3)=decode('ffd8ff','hex') and substring(bytes from octet_length(bytes)-1 for 2)=decode('ffd9','hex')
 when 'webp' then substring(bytes from 1 for 4)=decode('52494646','hex') and substring(bytes from 9 for 4)=decode('57454250','hex') else false end;
exception when others then return false;
end;$$;
alter table public.club_branding add column if not exists logo_data text check(public.valid_club_logo(logo_data));
-- A stable club UUID permits additional inactive identities in the future.
-- The running installation still has one active club, selected by id=true.
alter table public.club_branding drop constraint if exists club_branding_id_check;
do $$declare primary_columns text[];
begin
 select array_agg(a.attname::text order by k.ordinality) into primary_columns from pg_constraint c cross join lateral unnest(c.conkey) with ordinality k(num,ordinality) join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num where c.conrelid='public.club_branding'::regclass and c.contype='p';
 if primary_columns=array['id'] then
  alter table public.club_branding drop constraint club_branding_pkey;
  alter table public.club_branding add constraint club_branding_pkey primary key(club_id);
 end if;
end;$$;
create unique index if not exists one_active_club_branding on public.club_branding(id) where id;
insert into public.club_branding(id) select true where not exists(select 1 from public.club_branding where id);
alter table public.club_branding enable row level security;
drop policy if exists club_branding_read on public.club_branding;
create policy club_branding_read on public.club_branding for select to anon,authenticated using(id);
revoke all on public.club_branding from public,anon,authenticated;
grant select(id,club_name,logo_data,primary_color,secondary_color,accent_color) on public.club_branding to anon,authenticated;

create or replace function public.save_club_identity(p_name text,p_logo text,p_primary text,p_secondary text,p_accent text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_name is null or length(trim(p_name)) not between 2 and 80 or p_name ~ '[[:cntrl:]]' then raise exception 'Gebruik een verenigingsnaam van 2 tot 80 tekens.';end if;
 if p_primary is null or p_secondary is null or p_accent is null or p_primary !~ '^#[0-9A-Fa-f]{6}$' or length(p_primary)<>7 or p_secondary !~ '^#[0-9A-Fa-f]{6}$' or length(p_secondary)<>7 or p_accent !~ '^#[0-9A-Fa-f]{6}$' or length(p_accent)<>7 then raise exception 'Gebruik geldige HEX-kleuren in de vorm #RRGGBB.';end if;
 if not public.valid_club_logo(p_logo) then raise exception 'Gebruik een geldig PNG-, JPEG- of WebP-logo van maximaal 256 KB.';end if;
 insert into public.club_branding(id,club_name,logo_data,primary_color,secondary_color,accent_color,updated_at,updated_by)
 values(true,trim(p_name),p_logo,upper(p_primary),upper(p_secondary),upper(p_accent),now(),auth.uid())
 on conflict(id) where id do update set club_name=excluded.club_name,logo_data=excluded.logo_data,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into public.audit_log(actor_id,action,details) values(auth.uid(),'save_club_identity',jsonb_build_object('club_name',trim(p_name),'primary',upper(p_primary),'secondary',upper(p_secondary),'accent',upper(p_accent),'has_logo',p_logo is not null));
end;$$;
-- Old clients can still save the two colours, without resetting name/logo/accent.
create or replace function public.save_club_branding(p_primary text,p_secondary text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Geen beheerrechten.';end if;
 if p_primary is null or p_secondary is null or length(p_primary)<>7 or length(p_secondary)<>7 or p_primary !~ '^#[0-9A-Fa-f]{6}$' or p_secondary !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Gebruik geldige HEX-kleuren in de vorm #RRGGBB.';end if;
 insert into public.club_branding(id,primary_color,secondary_color,updated_at,updated_by) values(true,upper(p_primary),upper(p_secondary),now(),auth.uid())
 on conflict(id) where id do update set primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 insert into public.audit_log(actor_id,action,details) values(auth.uid(),'save_club_branding',jsonb_build_object('primary',upper(p_primary),'secondary',upper(p_secondary)));
end;$$;
revoke all on function public.valid_club_logo(text) from public,anon,authenticated;
revoke all on function public.save_club_identity(text,text,text,text,text),public.save_club_branding(text,text) from public,anon;
grant execute on function public.save_club_identity(text,text,text,text,text),public.save_club_branding(text,text) to authenticated;
commit;
