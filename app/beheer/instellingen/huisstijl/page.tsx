import Link from 'next/link';
import { getData } from '@/lib/data';
import { getBranding } from '@/lib/branding-server';
import { Shell } from '@/components/shell';
import { Heading, Notice } from '@/components/ui';
import { BrandingEditor } from '@/components/branding-editor';
export default async function BrandSettings({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const data=await getData('settings');
  const [branding,params]=await Promise.all([getBranding(),searchParams]);
  return <Shell data={data}><div className="breadcrumbs"><Link href="/beheer">Beheer</Link><span>/</span><span>Instellingen</span><span>/</span><span>Huisstijl</span></div><Heading title="Huisstijl"/><div className="settings-tabs"><span aria-current="page">Huisstijl</span></div><Notice params={params}/>
    {!branding.available && <p className="notice warning" role="alert">De huisstijlgegevens zijn niet beschikbaar. Opslaan is uitgeschakeld. Controleer of migratie 002_club_branding.sql in Supabase is uitgevoerd en de database bereikbaar is.</p>}
    <BrandingEditor initial={branding} available={branding.available}/>
  </Shell>;
}
