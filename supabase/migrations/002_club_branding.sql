-- Additive migration: existing members, roles, duties and points remain intact.
begin;
create table if not exists public.club_branding (
  id boolean primary key default true check (id),
  primary_color text not null default '#087D56' check (length(primary_color)=7 and primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#6483B8' check (length(secondary_color)=7 and secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.club_branding(id) values(true) on conflict(id) do nothing;
alter table public.club_branding enable row level security;
drop policy if exists club_branding_read on public.club_branding;
create policy club_branding_read on public.club_branding for select to anon,authenticated using (true);
-- Colours are public (including on login), but editor identities are not.
revoke all on public.club_branding from public,anon,authenticated;
grant select(id,primary_color,secondary_color) on public.club_branding to anon,authenticated;

create or replace function public.save_club_branding(p_primary text,p_secondary text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_manager() then raise exception 'Geen beheerrechten.'; end if;
  if p_primary is null or p_secondary is null or length(p_primary)<>7 or length(p_secondary)<>7 or p_primary !~ '^#[0-9A-Fa-f]{6}$' or p_secondary !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'Gebruik geldige HEX-kleuren in de vorm #RRGGBB.';
  end if;
  insert into public.club_branding(id,primary_color,secondary_color,updated_at,updated_by)
    values(true,upper(p_primary),upper(p_secondary),now(),auth.uid())
  on conflict(id) do update set primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,
    updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  insert into public.audit_log(actor_id,action,details) values(auth.uid(),'save_club_branding',
    jsonb_build_object('primary',upper(p_primary),'secondary',upper(p_secondary)));
end;
$$;
revoke all on function public.save_club_branding(text,text) from public,anon;
grant execute on function public.save_club_branding(text,text) to authenticated;
commit;
