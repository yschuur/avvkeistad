import Link from 'next/link';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { DutyCreateSection,PlanningSection,CorrectionsSection } from '@/components/management/sections';
export default async function Planning({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams;
 const selection=params.match?{...data,duties:data.duties.filter(d=>d.match_id===params.match)}:data;
 return <Shell data={data}><Heading title="Planning"><Link className="button secondary" href="/beheer/wedstrijden">Wedstrijdfluitdiensten</Link></Heading><Notice params={params}/>{params.match?<p className="notice">Planning voor de geselecteerde wedstrijd. <Link href="/beheer/planning">Alle diensten bekijken</Link></p>:<DutyCreateSection data={data}/>}<PlanningSection data={selection}/><CorrectionsSection data={selection}/></Shell>;
}
