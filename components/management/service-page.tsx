import { ManagedDutyList } from './duty-management';
import { getData } from '@/lib/data';
import { getDutySettings } from '@/lib/duty-settings';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { DutyCreateSection } from '@/components/management/sections';
export default async function ServicePage({kind,title,path,searchParams}:{kind:'bar'|'event'|'other';title:string;path:string;searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams,settings=await getDutySettings();
 const duties=data.duties.filter(d=>d.kind===kind||(kind==='other'&&d.kind==='lines'));
 return <Shell data={data}><Heading title={title}><a className="button" href="#dienst-aanmaken">Nieuwe dienst</a></Heading><Notice params={params}/><ManagedDutyList data={{...data,duties}} returnTo={path} params={params} teamAssignmentAvailable={settings.available}/><details className="service-create"><summary tabIndex={0}>Nieuwe dienst of reeks aanmaken</summary><DutyCreateSection data={data} refereePoints={settings.refereePoints} fixedKind={kind} returnTo={path}/></details></Shell>;
}
