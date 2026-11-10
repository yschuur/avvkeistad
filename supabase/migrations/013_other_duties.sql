begin;
alter table public.duties drop constraint if exists duties_kind_check;
alter table public.duties add constraint duties_kind_check check(kind in ('bar','referee','event','lines','other'));
notify pgrst,'reload schema';
commit;
