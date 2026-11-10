import { formatInTimeZone } from 'date-fns-tz';
import { planningMonth,planningUrl,monthLabel } from '@/lib/planning';
import { PageNavigation } from '@/components/page-navigation';
import { ManagedDutyList } from '@/components/management/duty-management';
import { getDutySettings } from '@/lib/duty-settings';
import Link from 'next/link';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { DutyCreateSection } from '@/components/management/sections';
export default async function Planning({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const params=await searchParams,data=await getData(params.match?'management':'planning',params.month??params.day?.slice(0,7)),settings=await getDutySettings();
 const matchDuty=params.match?data.duties.find(d=>d.match_id===params.match):null;
 const month=planningMonth(matchDuty?formatInTimeZone(matchDuty.starts_at,'Europe/Amsterdam','yyyy-MM'):params.month??params.day?.slice(0,7),data.season),filters={...params,month:month.month};
 return <Shell data={data}><Heading title="Planning" description={month.label}>{!params.match&&<a className="button" href="#dienst-aanmaken">Nieuwe dienst</a>}<Link className="button secondary" href="/beheer/wedstrijden">Wedstrijdfluitdiensten</Link></Heading><Notice params={params}/>{params.match?<p className="notice">Planning voor de geselecteerde wedstrijd. <Link href="/beheer/planning">Alle diensten bekijken</Link></p>:null}{!settings.available&&<p className="notice warning">Voer migratie 008 uit voor teamtoewijzing en standaardpunten.</p>}<ManagedDutyList data={data} returnTo="/beheer/planning" params={filters} collapseDays teamAssignmentAvailable={settings.available}/>{!params.match&&<PageNavigation name="Planningmaanden" label="Maand" current={month.months.indexOf(month.month)+1} pages={month.months.map(m=>({label:monthLabel(m),href:planningUrl(filters,{month:m,day:undefined,duty:undefined})}))}/>}{!params.match&&<details className="service-create"><summary tabIndex={0}>Nieuwe dienst of reeks aanmaken</summary><DutyCreateSection data={data} refereePoints={settings.refereePoints} returnTo={planningUrl(filters)}/></details>}</Shell>;
}
