-- Activate only AFTER the verified source adapter has completed its first live
-- import. This file is environment setup, not a schema migration.
-- 1. Set a random CRON_SECRET (>=32 characters) in Vercel and redeploy.
-- 2. In Supabase Vault, create avv_nevobo_cron_secret with the SAME value.
-- 3. Complete a manual, verified import before running this script.
-- This script contains no credential values and does not replace other jobs.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
do $$
begin
 if not exists(select 1 from public.nevobo_sync_state where id and last_success_at is not null) then
  raise exception 'Voltooi eerst een gecontroleerde live-import; de RSS-adapter moet geverifieerd zijn.';
 end if;
 if not exists(select 1 from vault.decrypted_secrets where name='avv_nevobo_cron_secret' and length(decrypted_secret)>=32) then
  raise exception 'Stel eerst de cron-token veilig in via Supabase Vault en Vercel.';
 end if;
end;
$$;
select cron.schedule('avv-keistad-nevobo-import','0 */4 * * *',$job$
 select net.http_post(
  url:='https://avvkeistad-vrijwilligers.vercel.app/api/nevobo/sync',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='avv_nevobo_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
-- Retry delivery separately; a mail-provider error must not lose app notices.
select cron.schedule('avv-keistad-nevobo-mail','* * * * *',$job$
 select net.http_post(
  url:='https://avvkeistad-vrijwilligers.vercel.app/api/nevobo/notifications',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='avv_nevobo_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
commit;
