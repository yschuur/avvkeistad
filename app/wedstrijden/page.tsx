import { getData } from '@/lib/data';
import { Shell } from '@/components/shell';
import { Heading, date, time } from '@/components/ui';
export default async function MatchesPage() {
  const data = await getData();
  return <Shell data={data}><Heading eyebrow="LANGS DE LIJN" title="Het wedstrijdprogramma" description="Samen spelen, samen mogelijk maken."/><div className="notice">De automatische Nevobo-koppeling is nog niet ingericht. {data.demo ? 'Hieronder staat een voorbeeldwedstrijd.' : 'Dit overzicht bevat alleen al geïmporteerde wedstrijden.'} <a href="https://www.volleybal.nl/competitie/vereniging/ckl7s2r#program" target="_blank" rel="noreferrer">Bekijk het actuele bondsprogramma ↗</a></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>Datum</th><th>Wedstrijd</th><th>Locatie</th><th>Niveau</th><th>Scheidsrechter</th></tr></thead><tbody>{data.matches.map(m=><tr key={m.id}><td>{date(m.starts_at)}<small>{time(m.starts_at)}</small></td><td><strong>{m.home_team}</strong><small>tegen {m.away_team}</small></td><td>{m.location}</td><td>{m.level}</td><td><span className="badge">{m.club_referee?'Via de club':'Via de bond'}</span></td></tr>)}</tbody></table>{!data.matches.length && <p className="empty-state">Er zijn nog geen wedstrijden geïmporteerd.</p>}</div></section></Shell>;
}
