import Link from 'next/link';
import { getData } from '@/lib/data';
import { getEditableBranding } from '@/lib/branding-server';
import { Shell } from '@/components/shell';
import { Heading, Notice } from '@/components/ui';
import { BrandingEditor } from '@/components/branding-editor';
export default async function BrandSettings({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const data=await getData('settings');
  const [branding,params]=await Promise.all([getEditableBranding(),searchParams]);
  return <Shell data={data}><div className="breadcrumbs"><Link href="/beheer">Beheer</Link><span>/</span><Link href="/beheer/instellingen">Instellingen</Link><span>/</span><span>Huisstijl</span></div><Heading title="Huisstijl"/><div className="settings-tabs"><span aria-current="page">Huisstijl</span></div><Notice params={params}/>
    {!branding.available && <div className="notice warning" role="alert"><p>{branding.issue==='access'?'De database weigert het ophalen van de huisstijl. Je instellingen zijn niet overschreven.':branding.issue==='migration'?'De huisstijltabel is nog niet beschikbaar via de database-API.':branding.issue==='missing'?'Er is geen actieve huisstijl gevonden in de database.':branding.issue==='invalid'?'De opgeslagen huisstijl bevat ongeldige gegevens.':'De huisstijl kon nu niet worden opgehaald. Dit betekent niet automatisch dat migratie 007 ontbreekt.'}</p><a className="button secondary" href="/beheer/instellingen/huisstijl">Opnieuw ophalen</a></div>}
    {branding.available&&!branding.identityAvailable&&<div className="notice warning" role="alert"><p>De database-API levert nog alleen de oude kleurvelden. Kleuren aanpassen blijft beschikbaar.</p><p>Is migratie 007 al uitgevoerd? Haal de instellingen opnieuw op. Blijft dit zo, laat dan de API-schemacache in Supabase verversen en controleer of de app hetzelfde Supabase-project gebruikt.</p><a className="button secondary" href="/beheer/instellingen/huisstijl">Opnieuw ophalen</a></div>}{branding.available&&<BrandingEditor key={branding.identityAvailable?'identity':'legacy'} initial={branding} available={branding.available} identityAvailable={branding.identityAvailable}/>}
  </Shell>;
}
