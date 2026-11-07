# AVV Keistad · Vrijwilligersportaal

Next.js-app voor Vercel met Supabase Auth en PostgreSQL. Zonder Supabase-instellingen draait een **alleen-lezen voorbeeldomgeving**. Voorbeeldleden zijn fictief. Er worden nooit voorbeeldgegevens naar Supabase geschreven.

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

De databasetest voert de daadwerkelijke migratie uit in een geïsoleerde PostgreSQL-runtime (PGlite). Hij test rechten, inschrijvingen, overlap, bevoegdheid, de 24-uursgrens, overdracht en intrekken na afloop. Dit vervangt geen integratietest met Supabase Auth en e-mail. Browsercontrole: `npm run test:browser` met een draaiende app; gebruikt de geïnstalleerde Chromium of `CHROMIUM_PATH`.

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

Dit is verplicht voor uitnodigingen die op een ander apparaat worden geopend. De callback accepteert token-hash-uitnodigingen en PKCE-codes; hij verwerkt geen access tokens in URL-fragmenten.

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

1. Zorg dat deze code op GitHub in `yschuur/avvkeistad` staat. De repository was bij aanvang leeg; deze lokale wijzigingen zijn niet automatisch gepusht.
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
- Supabase-project, echte login, uitnodigingen en SMTP zijn nog niet live getest; er zijn nog geen credentials beschikbaar.
- Wijzigingen aan wedstrijdtijden moeten uiteindelijk meldingen en conflictcontrole opleveren. Automatische e-mailherinneringen en wijzigingsmeldingen zijn nog niet ingebouwd.
- Scheidsrechtersniveaus zijn voorlopig genummerd 0–10. De concrete Nevobo-opleidingen en toegestane competities moeten aan deze niveaus worden gekoppeld voordat automatische fluitdiensten actief worden.
- De eerste versie beheert één actief seizoen; een apart seizoenarchief en seizoenwisselscherm volgen. Rapportage bevat nu team- en tekortfilters en CSV; uitgebreide periode-/functie-/dienstfilters volgen.
- Dienstannulering is beschikbaar; tijd wijzigen en gehele reeksen aanpassen met meldingen volgen.

Er is niets naar Vercel gedeployd en er zijn nog geen echte leden uitgenodigd.
