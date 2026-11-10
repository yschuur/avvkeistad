import { getData } from '@/lib/data';
import { getFunctionCatalog } from '@/lib/functions';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { FunctionGroupsWorkspace } from '@/components/function-management';
export default async function FunctionGroups({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams,catalog=await getFunctionCatalog(data.season?.id??null);
 return <Shell data={data}><Heading title="Functiegroepen" description={data.season?.name}/><Notice params={params}/><FunctionGroupsWorkspace data={data} catalog={catalog} selectedId={params.group}/></Shell>;
}
