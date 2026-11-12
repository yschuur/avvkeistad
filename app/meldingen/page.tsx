import Link from 'next/link';
import { getData } from '@/lib/data';
import { supabase } from '@/lib/supabase/server';
import { Shell } from '@/components/shell';
import { Heading, Notice, date, time } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
import { markNotificationRead } from '@/app/actions';
import type { Notification } from '@/lib/nevobo/types';
export default async function Notifications({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('notifications');
 const db=await supabase();
 const {data:rows,error}=await db.from('notifications').select('*').eq('member_id',data.profile.id).order('created_at',{ascending:false}).limit(100);
 const notifications=(rows ?? []) as Notification[];
 return <Shell data={data}><Heading title="Meldingen"/><Notice params={await searchParams}/>{error?<p className="notice" role="alert">Meldingen zijn nog niet beschikbaar. Neem contact op met de beheerder.</p>:notifications.length?<section className="notification-list">{notifications.map(n=><article key={n.id} className={`notification-row ${n.read_at?'':'unread'}`}><div><h2>{n.title}{!n.read_at && <span className="badge">Ongelezen</span>}</h2><p className="notification-body">{n.body}</p>{n.team_id?<Link href="/team">Mijn team bekijken</Link>:n.match_id && <Link href={`/wedstrijden?match=${encodeURIComponent(n.match_id)}&view=all`}>Wedstrijd bekijken</Link>}</div><div className="notification-meta"><time dateTime={n.created_at}>{date(n.created_at)} · {time(n.created_at)}</time>{!n.read_at && <form action={markNotificationRead}><input type="hidden" name="notification_id" value={n.id}/><SubmitButton className="button secondary">Markeren als gelezen</SubmitButton></form>}</div></article>)}</section>:<p className="empty-state">Geen meldingen.</p>}</Shell>;
}
