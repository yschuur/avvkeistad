import { getData } from '@/lib/data';
import { getFunctionCatalog } from '@/lib/functions';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { FunctionsWorkspace } from '@/components/function-management';
export default async function Functions({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('management'),params=await searchParams,catalog=await getFunctionCatalog(data.season?.id??null);
 return <Shell data={data}><Heading title="Functies" description={data.season?.name}/><Notice params={params}/><FunctionsWorkspace data={data} catalog={catalog} selectedId={params.function}/></Shell>;
}
