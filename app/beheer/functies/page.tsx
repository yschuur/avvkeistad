import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { FunctionGrantSection,FunctionDefinitionsSection } from '@/components/management/sections';
export default async function Functions({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams;
 return <Shell data={data}><Heading title="Functies"/><Notice params={params}/><FunctionGrantSection data={data}/><FunctionDefinitionsSection data={data}/></Shell>;
}
