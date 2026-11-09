import { redirect } from 'next/navigation';
export default async function LegacyLog({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {const params=new URLSearchParams(Object.entries(await searchParams).filter((entry):entry is [string,string]=>entry[1]!==undefined));redirect('/beheer/wedstrijden/log'+(params.size?'?'+params:''));}
