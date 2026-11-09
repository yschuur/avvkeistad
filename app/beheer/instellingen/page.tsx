import Link from 'next/link';
import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading } from '@/components/ui';
export default async function Settings() {
 const data=await getData('settings');
 return <Shell data={data}><Heading title="Instellingen"/><section className="panel"><h2>Clubinstellingen</h2><div className="management-links"><Link href="/beheer/instellingen/huisstijl"><span><strong>Huisstijl</strong><small>Verenigingsnaam, logo en clubkleuren</small></span><span aria-hidden="true">→</span></Link><Link href="/beheer/wedstrijden"><span><strong>Wedstrijdkoppeling</strong><small>Nevobo synchroniseren en importstatus bekijken</small></span><span aria-hidden="true">→</span></Link><Link href="/beheer/wedstrijden/log"><span><strong>Wijzigingslog</strong><small>Wijzigingen aan het wedstrijdprogramma</small></span><span aria-hidden="true">→</span></Link><Link href="/beheer/seizoenen"><span><strong>Seizoensinstellingen</strong><small>Puntennormen, periode en actief seizoen</small></span><span aria-hidden="true">→</span></Link></div></section></Shell>;
}
