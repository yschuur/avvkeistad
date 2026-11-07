import { fetchNevoboProgram } from './fetch-feed';
import { parseNevoboProgram } from './parse-feed';

export async function loadNevoboProgram() {
  return parseNevoboProgram(await fetchNevoboProgram());
}

export function syncErrorMessage(code:string) {
  const messages:Record<string,string>={
    nevobo_database_not_configured:'De databaseverbinding voor de import is niet ingesteld.',
    nevobo_migration_missing:'De Nevobo-databasemigratie ontbreekt of de server-sleutel heeft geen toegang.',
    nevobo_active_season_missing:'Stel eerst een actief seizoen in onder Beheer.',
    nevobo_feed_unreachable:'De Nevobo-bron is tijdelijk niet bereikbaar. De bestaande planning is behouden.',
    nevobo_feed_http_error:'Nevobo kon het programma niet leveren. De bestaande planning is behouden.',
    nevobo_invalid_match_identity:'Een wedstrijd heeft geen eenduidige Nevobo-identificatie. De import is niet toegepast.',
    nevobo_invalid_match_date:'Een geplande wedstrijd heeft geen geldige datum met tijdzone. De import is niet toegepast.',
    nevobo_conflicting_match_date:'De titel en datum van een wedstrijd spreken elkaar tegen. De import is niet toegepast.',
    nevobo_invalid_match_title:'De teams konden niet betrouwbaar uit de wedstrijdtitel worden gelezen. De import is niet toegepast.',
    nevobo_duplicate_match_id:'De bron bevat tegenstrijdige versies van dezelfde wedstrijd. De import is niet toegepast.',
  };
  return messages[code] ?? 'Synchroniseren is niet gelukt. De bestaande planning is behouden; controleer de Nevobo-bron en database-inrichting.';
}
