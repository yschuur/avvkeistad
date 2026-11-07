import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { importedMatch, type FeedSnapshot } from './types';
import { mailConfig, sendMatchEmail, type EmailJob } from './mail';

export function serviceClient() {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url || !key) throw new Error('nevobo_database_not_configured');
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function deliverMatchNotifications(db:SupabaseClient,limit=10) {
 const config=mailConfig();
 if(!config) return {configured:false,sent:0,failed:0};
 const {data,error}=await db.rpc('claim_notification_emails',{p_limit:limit});
 if(error) throw new Error('notification_claim_failed');
 let sent=0,failed=0;
 // Bounded concurrency keeps a batch inside a normal serverless request.
 const jobs=(data ?? []) as EmailJob[];
 for(let offset=0;offset<jobs.length;offset+=2) {
 const started=Date.now();
 await Promise.all(jobs.slice(offset,offset+2).map(async job=>{
  const result=await sendMatchEmail(job,config);
  const {error:finishError}=await db.rpc('finish_notification_email',{
   p_outbox:job.outbox_id,p_claim:job.claim,p_sent:result.sent,
   p_provider:result.sent?result.providerId:null,p_error:result.sent?null:result.code,
  });
  if(finishError) throw new Error('notification_ack_failed');
  if(result.sent) sent++;else failed++;
 }));
 if(offset+2<jobs.length) await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000-(Date.now()-started))));
 }
 return {configured:true,sent,failed};
}

/** Source-independent sync pipeline; the source adapter must return a verified snapshot. */
export async function synchronizeMatches(db:SupabaseClient,loadSnapshot:()=>Promise<FeedSnapshot>) {
 const {data:lease,error:leaseError}=await db.rpc('acquire_nevobo_sync');
 if(leaseError) throw new Error('nevobo_migration_missing');
 if(!lease) return {status:'busy' as const};
 try {
  const {data:season,error:seasonError}=await db.from('seasons').select('id').eq('active',true).maybeSingle();
  if(seasonError || !season) throw new Error('nevobo_active_season_missing');
  const snapshot=await loadSnapshot();
  if(snapshot.matches.length>5000) throw new Error('nevobo_snapshot_too_large');
  const matches=snapshot.matches.map(item=>importedMatch.parse(item));
  if(new Set(matches.map(m=>m.external_id)).size!==matches.length) throw new Error('nevobo_duplicate_match_id');
  const {data,error}=await db.rpc('apply_nevobo_snapshot',{
   p_lease:lease,p_season:season.id,p_matches:matches,p_published:snapshot.publishedAt,
   p_complete:snapshot.complete && matches.length>0,
  }).abortSignal(AbortSignal.timeout(20000));
  if(error) throw new Error('nevobo_snapshot_apply_failed');
  // Email delivery is separate from a successful import. Its failure must not
  // cause a duplicate snapshot or lose the already-created in-app notifications.
  let mail:Awaited<ReturnType<typeof deliverMatchNotifications>>|{error:true};
  try {mail=await deliverMatchNotifications(db,2);}catch{mail={error:true};}
  return {status:'synced' as const,counts:data,mail};
 } catch(error) {
  const known=error instanceof Error && /^nevobo_[a-z_]+$/.test(error.message)?error.message:'nevobo_sync_failed';
  await db.rpc('fail_nevobo_sync',{p_lease:lease,p_code:known});
  throw new Error(known);
 }
}
