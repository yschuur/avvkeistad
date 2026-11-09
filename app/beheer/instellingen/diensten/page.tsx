import { getData } from '@/lib/data';
import { getDutySettings } from '@/lib/duty-settings';
import { saveDutySettings } from '@/app/actions';
import { Shell } from '@/components/shell';
import { Heading,Notice } from '@/components/ui';
import { SubmitButton } from '@/components/submit-button';
export default async function DutySettings({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 const data=await getData('settings'),settings=await getDutySettings(),params=await searchParams;
 return <Shell data={data}><Heading title="Diensten"/><Notice params={params}/><section className="panel"><h2>Punten voor fluitbeurten</h2><p className="muted">Dit puntenaantal geldt per deelnemer voor nieuwe fluitdiensten. Bestaande diensten en behaalde punten blijven gelijk. Bij overige diensten geldt 1 uur = 1 punt.</p>{!settings.available&&<p className="notice warning">Voer migratie 008_team_duties_and_referee_defaults.sql uit in de database van deze app.</p>}<form action={saveDutySettings} className="stack-form duty-settings-form"><label htmlFor="referee-points">Standaardpunten per fluitbeurt<input id="referee-points" name="referee_points" type="number" min="0.25" max="1000" step="0.25" defaultValue={settings.refereePoints??''} key={settings.refereePoints} required disabled={!settings.available}/></label><SubmitButton className="button" disabled={!settings.available}>Punten opslaan</SubmitButton></form></section></Shell>;
}
