# AVV Keistad · Vrijwilligersportaal

Next.js-app voor Vercel met Supabase Auth en PostgreSQL. Zonder Supabase-instellingen toont de applicatie een configuratiemelding. Er is geen voorbeeldadministratie of automatische demo-identiteit. Lees `DESIGN_SYSTEM.md` en `AGENTS.md` voordat je UI wijzigt.

## Lokaal werken

Vereist: Node.js 22 of 24 en npm. Gebruik de bestaande checkout; een cloudtaak is al geïsoleerd, maak geen extra worktree.

```sh
cd /workspace/avvkeistad
npm ci
npm run dev
```

Maak voor echte gegevens `.env.local` op basis van `.env.example`. Zet sleutels nooit in Git of chat. Na het wijzigen van variabelen de ontwikkelserver herstarten.

```sh
npm test
npm run build
```

De databasetest voert de daadwerkelijke migratie uit in een geïsoleerde PostgreSQL-runtime (PGlite). Hij test rechten, inschrijvingen, overlap, bevoegdheid, de 24-uursgrens, overdracht en intrekken na afloop. Dit vervangt geen integratietest met Supabase Auth en e-mail. Browsercontrole: voer na `npm run build` de opdracht `npm run test:browser` uit. Die start zelf een geïsoleerde lokale Next-server en testbackend; gebruikt de geïnstalleerde Chromium of `CHROMIUM_PATH`. Er worden geen echte clubaccounts of gegevens gebruikt.

## 1. Supabase aanmaken

1. Maak via https://supabase.com een organisatie en project aan, bij voorkeur in een beschikbare EU-regio. Bewaar het databasewachtwoord in een wachtwoordmanager.
2. Open **SQL Editor** en voer `supabase/migrations/001_initial.sql` eenmaal uit op het nieuwe project. Later toegevoegde migraties in volgorde uitvoeren; deze initiële migratie is geen herhaalbaar seedscript.
3. Zet publieke registratie uit bij **Authentication → Providers → Email**. Accounts worden uitsluitend door de club uitgenodigd.
4. Onder **Project Settings / Connect / API Keys** vind je de project-URL, publishable key en legacy `service_role` key. De `service_role` key is uitsluitend voor de server en geeft uitgebreide toegang.
5. Configureer eigen SMTP onder Authentication voor betrouwbare uitnodigingen naar echte leden. De ingebouwde Supabase-mailvoorziening heeft verzend- en ontvangersbeperkingen.
6. Stel de uitnodigingsmailtemplate in op een directe token-hash-link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Account activeren</a>
```

Token-hash-links worden aanbevolen en werken ook op een ander apparaat. De callback accepteert token-hash-links en PKCE-codes. De standaard Supabase-template met sessietokens in het URL-fragment wordt ook ondersteund: de browser controleert de sessie met Supabase en verwijdert het fragment uit de adresgeschiedenis.

## 2. Eerste admin

Er bestaat bewust geen publiek admin-aanmaakscherm of standaardwachtwoord.

1. Voer eerst de migratie uit.
2. Maak je eigen account aan via **Authentication → Users → Add user / Create user** in Supabase, met een sterk wachtwoord en bevestigd e-mailadres. De database maakt automatisch het profiel aan.
3. Voer daarna dit uit in SQL Editor, met je eigen e-mailadres en naam:

```sql
update public.profiles
set role = 'admin', first_name = 'Jouw voornaam', last_name = 'Jouw achternaam'
where email = 'jouw-eigen-emailadres';
```

Controleer dat precies je eigen profiel admin is. Log vervolgens in op de app. Maak onder Beheer eerst een seizoen en teams aan, daarna kun je leden en beheerders uitnodigen. Stel je eigen teamindeling in als je ook lid bent.

## 3. Vercel koppelen

1. Zorg dat deze code op GitHub in `yschuur/avvkeistad` staat. Vercel bouwt wijzigingen vanuit de branch `main`; controleer bij elke publicatie de status van de deployment.
2. Maak via https://vercel.com een account aan met GitHub en kies **Add New → Project**. Importeer de repository. Framework: Next.js; root: de root van de repository; build: `npm run build`.
3. Voeg onderstaande variabelen toe in **Settings → Environment Variables**. Gebruik voor previews liefst een apart Supabase-project; een preview mag niet onbedoeld echte leden wijzigen.

| Variabele | Waarde | Geheim? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-project-URL | Nee |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key | Nee; toegang loopt via RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Legacy service_role key | **Ja, uitsluitend server** |
| `NEXT_PUBLIC_SITE_URL` | Canonieke URL van de app, zonder trailing slash | Nee |

4. Deploy. Stel de uiteindelijke URL vervolgens in als Supabase **Authentication → URL Configuration → Site URL** en voeg de exacte `/auth/confirm`-URL toe aan de toegestane redirect-URL's. Gebruik voor lokaal ontwikkelen ook de lokale callback.
5. Pas `NEXT_PUBLIC_SITE_URL` aan als de eerste Vercel-URL nog onbekend was en deploy opnieuw. Uitnodigingen gebruiken deze vaste URL, nooit een willekeurige request-host.
6. Test een uitnodiging op een ander apparaat, wachtwoord instellen, opnieuw inloggen, inschrijven en overnemen. Nodig pas daarna de club uit.

## Gedrag en beveiliging

- Rollen: admin, beheerder (`manager`), lid; aanvoerder is een bevoegdheid op de teamindeling per seizoen. Alleen admin nodigt accounts uit.
- Puntennorm: persoonlijk > leeftijdsklasse > algemeen. Teamindelingen en functiepunten zijn per seizoen.
- Dienstpunten tellen automatisch na de eindtijd, niet na handmatige goedkeuring. Een beheerder kan een inschrijving achteraf intrekken met reden. Geen punten voor ingetrokken of geannuleerde diensten.
- Afmelden kan strikt minder dan 24 uur na inschrijven en alleen voor de begintijd. Daarna kan een lid ter overname aanbieden. De oorspronkelijke deelnemer blijft ingepland tot de overname in één database-transactie slaagt.
- Ook een vervanger heeft vanaf zijn eigen inschrijving 24 uur bedenktijd (tot aanvang).
- Capaciteit, teamreservering, tijdsoverlap en scheidsrechtersniveau worden in PostgreSQL gecontroleerd. Databasevergrendeling voorkomt overboeking en dubbele overname.
- Bardiensten en andere reguliere diensten: duur in uren = punten per persoon. Fluitdiensten: vaste puntenwaarde. Wekelijkse reeksen behouden hun lokale Nederlandse aanvangstijd bij zomer-/wintertijd.
- Functietoekenningen geven meteen de expliciet gekozen punten voor de gekozen periode. Geen automatische proratering en geen autorisaties. Het wijzigen van een functiestandaard verandert bestaande toekenningen niet.
- Leden zien geen persoonsgegevens of inschrijvingen van willekeurige andere leden. Beschikbaarheid wordt als telling en anonieme overdracht-ID aangeboden. Aanvoerders zien hun team; beheerders zien de club.
- RLS beschermt alle tabellen. Gewone accounts hebben geen directe schrijfrechten; mutaties lopen via gecontroleerde databasefuncties. De server-sleutel wordt uitsluitend na controle van adminrechten voor uitnodigingen gebruikt.
- CSV-export beschermt spreadsheetcellen tegen formule-injectie.

## Nog te voltooien vóór clubbrede ingebruikname

- **Nevobo-import:** nog niet geïmplementeerd. De actuele officiële databron, velden, competitiemapping, thuiswedstrijden en wijzigings-/annuleringsregels moeten worden geverifieerd. Een proefrequest naar `api.nevobo.nl` werd door de cloudnetwerkpolicy geweigerd; dit bewijst niets over de beschikbaarheid of inhoud van die bron. Er is bewust geen fictieve synchronisatie of cronjob opgenomen. Het wedstrijdscherm meldt dit expliciet.
- De gebruiker heeft een werkende live login bevestigd. Uitnodigingen, SMTP en nieuwe migraties moeten nog op het eigen project worden gecontroleerd; de ontwikkeltests gebruiken een lokale testbackend.
- Wijzigingen aan wedstrijdtijden moeten uiteindelijk meldingen en conflictcontrole opleveren. Automatische e-mailherinneringen en wijzigingsmeldingen zijn nog niet ingebouwd.
- Scheidsrechtersniveaus zijn voorlopig genummerd 0–10. De concrete Nevobo-opleidingen en toegestane competities moeten aan deze niveaus worden gekoppeld voordat automatische fluitdiensten actief worden.
- De eerste versie beheert één actief seizoen; een apart seizoenarchief en seizoenwisselscherm volgen. Rapportage bevat nu team- en tekortfilters en CSV; uitgebreide periode-/functie-/dienstfilters volgen.
- Dienstannulering is beschikbaar; tijd wijzigen en gehele reeksen aanpassen met meldingen volgen.

De gebruiker beheert de live deployment via Vercel. Lokale tests tonen niet aan dat een nieuwe deployment of migratie al op productie is toegepast.

## Responsiviteit en performance

Elke pagina laadt alleen de datasets die hij gebruikt; persoonlijke overzichten filteren expliciet op lid en seizoen. Profiel en seizoen laden parallel. React memoization is uitsluitend per serverrequest: er is geen gedeelde cache met ledengegevens. JWT-controle gebruikt Supabase `getClaims()`; bij asymmetrische signing keys wordt de handtekening met gecachte publieke sleutels gecontroleerd. Legacy symmetrische sleutels vallen automatisch terug op de Auth-server. Mutaties blijven hun databasecontroles en RLS gebruiken.

Navigatie heeft directe laadfeedback en een streaming laadscherm. Serveractieknoppen tonen een spinner en zijn tijdens verwerking uitgeschakeld.

`npm run test:performance` start na een productiebuild een tijdelijke Next-server op poort 3011 en een lokale mock van de Supabase HTTP API. Met tijdelijk gegenereerde ondertekende testtokens en 150 ms nagebootste API-latentie controleert deze test onder meer parallel laden, aantallen API-verzoeken, filtering, gebruikersisolatie, ondertekende JWT-verificatie, redirects en directe knop-/navigatiefeedback. Er worden geen echte accounts of credentials gebruikt. Dit is geen meting van Vercel of de live Supabase-regio. `PERFORMANCE_TEST_PORT` kan een andere vrije poort kiezen; Chromium wordt via `CHROMIUM_PATH` ingesteld.

Vercel voert de serverfuncties volgens `vercel.json` uit in Dublin (`dub1`), nabij de door de gebruiker bevestigde Supabase-regio West EU (Ireland). Na een wijziging van de Supabase-regio moet deze instelling opnieuw worden beoordeeld. De instelling wordt bij de volgende Vercel-deployment toegepast; lokale tests meten geen productielatentie.

## Bestaand account herstellen

Open `/login` en kies **Wachtwoord vergeten?**. De app vraagt een herstelmail aan voor het bestaande account; rollen, teamindeling en punten veranderen niet. `NEXT_PUBLIC_SITE_URL` moet naar de vaste app-URL wijzen, en die URL met `/auth/confirm` moet als Supabase Auth redirect zijn toegestaan. De standaard Supabase-hersteltemplate werkt via deze flow. Een directe token-hash-template is ook mogelijk:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Wachtwoord herstellen</a>
```

Bij de nieuwe link kun je een wachtwoord van minimaal 12 tekens instellen. Een succesvolle aanvraag toont dezelfde tekst voor bestaande en onbekende adressen. De e-mailaflevering blijft afhankelijk van Supabase SMTP en verzendlimieten; de lokale integratietest verstuurt geen echte e-mail. Inlogmeldingen onderscheiden onjuiste credentials, onbevestigd e-mailadres, blokkering, rate limits en tijdelijke onbereikbaarheid zonder providerdetails of sleutels te tonen. Wachtwoorden worden exact doorgegeven, inclusief eventuele spaties aan begin en einde.

## Huisstijl en designsysteem

`DESIGN_SYSTEM.md` is de centrale standaard; `AGENTS.md` verplicht hergebruik ervan. De app gebruikt neutrale tokens en compacte lijsten/tabellen. Er is geen automatische demo-inhoud.

Voer op een bestaand project uitsluitend `supabase/migrations/002_club_branding.sql` uit om de huisstijlopslag toe te voegen. Op een nieuw project eerst 001, daarna 002. Migratie 002 voegt alleen een singleton-huisstijltabel, leesbeleid en beveiligde opslagfunctie toe; bestaande kleuren worden bij herhaald uitvoeren niet overschreven. Bestaande leden, rollen, punten en diensten blijven intact.

Admin en beheerder vinden de editor onder **Beheer → Instellingen → Huisstijl** (`/beheer/instellingen/huisstijl`). Primaire en secundaire kleur hebben een color picker en HEX-invoer met directe lokale preview. Opslaan maakt de kleuren clubbreed beschikbaar, ook na herladen/inloggen. Standaardkleuren herstellen vult de bestaande applicatiedefaults in; druk daarna op Opslaan. Voorgronden en focuskleuren worden automatisch aangepast voor contrast.

Alleen kleuren zijn publiek leesbaar; de identiteit van de editor is niet publiek uitleesbaar. Alleen admin/manager kan via de opslagfunctie schrijven. De app behoudt standaardkleuren als de migratie nog ontbreekt of de instelling niet kan worden opgehaald. De editor meldt dit en schakelt Opslaan uit. Na toepassen van de migratie de pagina herladen. Publieke kleurgegevens hebben een cache van 60 seconden; opslaan wist de cache direct.

`npm test` test onder meer de nieuwe migratie met daadwerkelijke PostgreSQL-rechten en kleurcontrast voor een RGB-steekproef. `npm run test:browser` en `npm run test:performance` gebruiken dezelfde lokale integratiesuite, inclusief huisstijlpreview, bewaren/herladen/reset, mobiele navigatie en bestaande auth-/herstelflows. `SCREENSHOT_DIR` kan een uitvoermap voor screenshots van uitsluitend deze testomgeving instellen.
