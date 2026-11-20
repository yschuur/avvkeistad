import { InfoButton } from '@/components/info-button';
import { AdminHelp } from '@/components/admin-help';
import { ManagedDutyList } from './duty-management';
import { managedDutyData } from '@/lib/duty-loading';
import { getDutySettings } from '@/lib/duty-settings';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { DutyCreateSection } from '@/components/management/sections';
export default async function ServicePage({kind,title,path,searchParams}:{kind:'bar'|'event'|'other';title:string;path:string;searchParams:Promise<Record<string,string|undefined>>}) {
 const params=await searchParams;
 const [{data,listedDuties},settings]=await Promise.all([managedDutyData(params,kind),getDutySettings()]);
 return <Shell data={data}><Heading help={<InfoButton topic="Diensten beheren"><AdminHelp topic="duties"/></InfoButton>} title={title}><a className="button" href="#dienst-aanmaken">Nieuwe dienst</a></Heading><Notice params={params}/><ManagedDutyList data={data} listedDuties={listedDuties} returnTo={path} params={params} lazyManagement teamAssignmentAvailable={settings.available}/><details className="service-create"><summary tabIndex={0}>Nieuwe dienst of reeks aanmaken</summary><DutyCreateSection data={data} refereePoints={settings.refereePoints} fixedKind={kind} returnTo={path}/></details></Shell>;
}
