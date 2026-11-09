-- OPTIONAL: activate only when Resend is configured and a self-test succeeded.
-- First complete supabase/nevobo_cron.sql (import + shared Vault secret).
-- Not required to fetch or update the Nevobo match schedule.
begin;
-- Retry delivery separately; a mail-provider error must not lose app notices.
select cron.schedule('avv-keistad-nevobo-mail','* * * * *',$job$
 select net.http_post(
  url:='https://avvkeistad-vrijwilligers.vercel.app/api/nevobo/notifications',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='avv_nevobo_cron_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=60000
 );
$job$);
commit;
