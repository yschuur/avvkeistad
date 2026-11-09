import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { ReportSection } from '@/components/management/sections';
export default async function Report({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('report'),params=await searchParams;
 return <Shell data={data}><Heading title="Rapportage"/><Notice params={params}/><ReportSection data={data} params={params}/></Shell>;
}
