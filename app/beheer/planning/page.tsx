import { ManagedDutyList } from '@/components/management/duty-management';
import { getDutySettings } from '@/lib/duty-settings';
import Link from 'next/link';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { DutyCreateSection } from '@/components/management/sections';
export default async function Planning({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams,settings=await getDutySettings();
 const selection=params.match?{...data,duties:data.duties.filter(d=>d.match_id===params.match)}:data;
 return <Shell data={data}><Heading title="Planning">{!params.match&&<a className="button" href="#dienst-aanmaken">Nieuwe dienst</a>}<Link className="button secondary" href="/beheer/wedstrijden">Wedstrijdfluitdiensten</Link></Heading><Notice params={params}/>{params.match?<p className="notice">Planning voor de geselecteerde wedstrijd. <Link href="/beheer/planning">Alle diensten bekijken</Link></p>:null}{!settings.available&&<p className="notice warning">Voer migratie 008 uit voor teamtoewijzing en standaardpunten.</p>}<ManagedDutyList data={selection} returnTo="/beheer/planning" params={params} teamAssignmentAvailable={settings.available}/>{!params.match&&<details className="service-create"><summary tabIndex={0}>Nieuwe dienst of reeks aanmaken</summary><DutyCreateSection data={data} refereePoints={settings.refereePoints}/></details>}</Shell>;
}
