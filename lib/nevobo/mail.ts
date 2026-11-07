import { z } from 'zod';

export type EmailJob={outbox_id:string;claim:string;recipient:string;subject:string;body:string;notification_id:string};
export type MailResult={sent:true;providerId:string}|{sent:false;code:string};
export type MailConfig={key:string;from:string;siteUrl:string};
export function mailConfig(env:Record<string,string|undefined>=process.env):MailConfig|null {
  if(!env.RESEND_API_KEY || !env.NOTIFICATION_FROM_EMAIL || !env.NEXT_PUBLIC_SITE_URL) return null;
  if(!z.email().safeParse(env.NOTIFICATION_FROM_EMAIL).success) return null;
  try { const site=new URL(env.NEXT_PUBLIC_SITE_URL);if(!['http:','https:'].includes(site.protocol)) return null; }
  catch {return null;}
  return {key:env.RESEND_API_KEY,from:env.NOTIFICATION_FROM_EMAIL,siteUrl:env.NEXT_PUBLIC_SITE_URL};
}
export async function sendMatchEmail(job:EmailJob,config:MailConfig,fetcher:typeof fetch=fetch):Promise<MailResult> {
  if(!z.email().safeParse(job.recipient).success) return {sent:false,code:'invalid_recipient'};
  try {
    const response=await fetcher('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${config.key}`,'Content-Type':'application/json','Idempotency-Key':`nevobo-${job.notification_id}`},
      body:JSON.stringify({from:`AVV Keistad <${config.from}>`,to:[job.recipient],subject:`AVV Keistad · ${job.subject}`,
        text:`${job.body}\n\nBekijk je meldingen: ${new URL('/meldingen',config.siteUrl)}\n\nDit bericht is afkomstig van het vrijwilligersportaal van AVV Keistad.`}),
      signal:AbortSignal.timeout(10000),
    });
    if(!response.ok) return {sent:false,code:`provider_http_${response.status}`};
    const payload:unknown=await response.json();
    const id=typeof payload==='object' && payload!==null && 'id' in payload?String(payload.id):'';
    return id?{sent:true,providerId:id}:{sent:false,code:'invalid_provider_response'};
  } catch {return {sent:false,code:'provider_unreachable'};}
}
