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

Controleer dat precies je eigen profiel admin is. Log vervolgens in op de app. Schakel linksonder Beheermodus in en maak bij Seizoenen en Teams het seizoen en de teams aan, daarna kun je leden en beheerders uitnodigen. Stel je eigen teamindeling in als je ook lid bent.

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
- Functies en functiegroepen geven meteen hun vaste punten voor het volledige seizoen, zonder proratering of extra autorisaties. Het aanpassen van de puntenwaarde wijzigt alle gekoppelde toekenningen in datzelfde seizoen. Oude vrije toekenningen zonder koppeling behouden hun oorspronkelijke punten en periode.
- Leden zien geen persoonsgegevens of inschrijvingen van willekeurige andere leden. Beschikbaarheid wordt als telling en anonieme overdracht-ID aangeboden. Aanvoerders zien hun team; beheerders zien de club.
- RLS beschermt alle tabellen. Gewone accounts hebben geen directe schrijfrechten; mutaties lopen via gecontroleerde databasefuncties. De server-sleutel wordt uitsluitend na controle van adminrechten voor uitnodigingen gebruikt.
- CSV-export beschermt spreadsheetcellen tegen formule-injectie.

## Nog te voltooien vóór clubbrede ingebruikname

- **Nevobo-koppeling:** geïmplementeerd met parser, wijzigingshistorie, appmeldingen en Resend. Activering van de import vereist migratie 003, een eerste gecontroleerde import en Supabase Cron; Resend is optioneel en kan later worden ingesteld; zie de activatiestappen hieronder. De volledige live bronverbinding en echte e-mailaflevering zijn nog niet vanuit deze ontwikkelomgeving geverifieerd.
- De gebruiker heeft een werkende live login bevestigd. Uitnodigingen, SMTP en nieuwe migraties moeten nog op het eigen project worden gecontroleerd; de ontwikkeltests gebruiken een lokale testbackend.
- Wijzigingsmeldingen voor gekoppelde scheidsrechters zijn ingebouwd. Bij verplaatsing blijft de toewijzing behouden; de scheidsrechter moet controleren of de nieuwe planning past. Algemene dienstherinneringen buiten deze wedstrijdmeldingen zijn nog niet ingebouwd.
- Scheidsrechtersniveaus zijn V6, V4, R2.2, R2, R1, N3, N2 en N1, oplopend van laag naar hoog (migratie 005). Migratie 006 bepaalt of een clubscheidsrechter nodig is en welk minimum geldt uit het opgeslagen teamniveau volgens de vastgestelde clubregels; een Nevobo-wedstrijdcode wordt niet als opleidingsniveau geïnterpreteerd.
- Seizoenen kunnen afzonderlijk worden aangemaakt, bewerkt en geactiveerd via Beheer → Seizoenen (migratie 004). De ledenapp en Nevobo-import gebruiken één actief seizoen. Rapportage bevat team- en tekortfilters en CSV; uitgebreide periode-/functie-/dienstfilters volgen.
- Dienstannulering is beschikbaar. Gekoppelde fluitdiensten volgen Nevobo-wijzigingen automatisch; handmatige tijdswijzigingen en het aanpassen van volledige algemene dienstenreeksen volgen nog.

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

## Huisstijl en clubidentiteit

Voer op een bestaand Supabase-project **`supabase/migrations/007_club_identity.sql`** uit in SQL Editor. Deze migratie werkt na 001, met of zonder de oudere huisstijlmigratie 002. Voer 001 niet opnieuw uit. Bestaande primaire/secundaire kleuren blijven behouden; de nieuwe accentkleur begint met de bestaande primaire kleur. Leden, rollen, seizoenen, punten, teams en diensten blijven intact. De migratie is herhaalbaar.

Admin en beheerder vinden **Beheer → Instellingen → Huisstijl** (`/beheer/instellingen/huisstijl`). Stel verenigingsnaam, logo en drie onafhankelijke kleuren in. Kleurkiezers en HEX-invoer hebben een directe lokale preview van navigatie, knoppen, kaarten en voortgang. Opslaan past de identiteit clubbreed toe, ook na herladen en opnieuw inloggen. Standaardkleuren herstellen verandert alleen de kleuren; naam en logo blijven behouden. Druk daarna op Opslaan.

Het logo mag PNG, JPEG of WebP zijn, maximaal 256 KB; de upload controleert ook maximaal 4096 × 4096 pixels. SVG/externe URL’s zijn niet toegestaan. Het logo wordt als begrensde data-URL in de bestaande instelling opgeslagen; een storagebucket is niet nodig. Tekst en focus krijgen automatisch voldoende contrast. Functionele statuskleuren blijven onafhankelijk van clubkleuren.

Alleen naam, logo en kleuren zijn publiek leesbaar, zodat ook het inlogscherm dezelfde identiteit toont. Editor-ID en auditgegevens blijven afgeschermd. Alleen admin/manager schrijft via een beveiligde databasefunctie. Opslaan logt naam, kleuren en aanwezigheid van een logo in `audit_log`, zonder de afbeelding te kopiëren. De tabel gebruikt een stabiele club-UUID en één actieve identiteit; er is nog geen volledige ondersteuning voor meerdere verenigingen met gescheiden leden/administraties. De Nevobo-koppeling en teamherkenning blijven voor Keistad geconfigureerd.

Zonder 007 maar met 002 blijven de twee bestaande kleuren bewerkbaar. De editor benoemt dat de database-API nog alleen oude kleurvelden levert en biedt Opnieuw ophalen. Als 007 al is uitgevoerd maar de API die velden nog niet ziet, ververs de PostgREST-schemacache via `NOTIFY pgrst, 'reload schema';` in de Supabase SQL Editor en controleer of app en SQL Editor hetzelfde project gebruiken. Dit verandert geen clubgegevens en vereist niet dat 007 opnieuw wordt uitgevoerd. Zonder bereikbare huisstijlopslag gebruikt de app de standaardidentiteit en toont de editor een melding met Opnieuw ophalen. Publieke instellingen hebben een cache van 60 seconden; opslaan wist die direct. De beheereditor haalt de instellingen apart en vers op via de ingelogde sessie. Een oude publieke respons na migratie 007 blokkeert de editor daardoor niet meer. Een tijdelijke databasefout biedt Opnieuw ophalen en overschrijft geen opgeslagen instellingen. De naam wordt gebruikt in de sidebar, login, wachtwoordherstel, paginatitel en wijzigingsmails. De CSV-export heet clubonafhankelijk `vrijwilligerspunten.csv`.

Het gedeelde Friendly Club Portal-designsysteem gebruikt standaard 2px hoeken (dialogen maximaal 4px), witte kaarten voor leden en compacte tabellen/formulieren voor beheer. Mijn overzicht toont echte puntenvoortgang, de volgende eigen dienst en passende open diensten. Mobiel zijn inschrijfknoppen kaartbreed, staan de belangrijkste bestemmingen in een vaste onderbalk en opent een vaste, duidelijk gelabelde Menu-knop linksboven de volledige navigatie vanaf links. Het menu sluit met Sluiten, Escape, de achtergrond of na navigeren en houdt toetsenbordfocus binnen het paneel. Een vaste bovenbalk toont club en omgeving naast de menuknop. Leden-, wedstrijd-, seizoen- en puntenoverzichten worden gelabelde kaarten; de filters zijn inklapbaar. Velden gebruiken 16px tekst en 48px hoogte. Planning toont eerst de diensten, met een directe Nieuwe dienst-knop naar het formulier. Huisstijl heeft een compacte opslaabalk boven de mobiele navigatie. Alle bestaande rollen, routes en punten-/scheidsrechtersregels blijven behouden.

`npm test` controleert onder meer de echte migraties, rechten, gegevensbehoud en merkcontrast. `npm run test:browser` gebruikt uitsluitend een lokale testbackend voor huisstijlpreview, logo, bewaren/herladen/reset, publieke login-identiteit, migratieterugval, mobiele navigatie en bestaande workflows. De mobiele controle omvat 320/390/768px en echte touch-emulatie voor inschrijven, filters, bewerken en huisstijl bewaren/herladen. `SCREENSHOT_DIR` stelt een uitvoermap in voor screenshots van uitsluitend deze testomgeving.

## Nevobo-koppeling activeren

De bron is `https://api.nevobo.nl/export/vereniging/CKL7S2R/programma.rss`. De adapter is gebaseerd op de door de gebruiker aangeleverde echte RSS-items. Club- en sponsornamen mogen zelf streepjes bevatten; bij meerdere streepjes wordt de wedstrijdgrens herkend aan de volledige teamaanduidingen. Bij een onduidelijke grens wordt de import geweigerd. De titelprefix `Vervallen:` en het veld `Vervallen wedstrijd` worden verwerkt zonder de teamnaam te vervuilen. Conceptwedstrijden blijven zichtbaar met een niet-bevestigde status en zijn niet inschrijfbaar. De permalink levert een stabiel wedstrijd-ID; `pubDate` levert voor geplande wedstrijden de wedstrijddatum inclusief tijdzone, gecontroleerd tegen datum/tijd in de titel. Een expliciete afgelasting of uitslag wordt ook bij een ontbrekende/tegenstrijdige nieuwe datum verwerkt; de database bewaart dan de eerder bekende planning. `nevobo:status` bepaalt de bronstatus. Wedstrijdcode, teams, sporthal, adres, postcode, plaats en beschikbare aanvullende velden blijven bewaard. Er worden geen voorbeeldwedstrijden in productie geplaatst.

De directe bronverbinding is vanuit de Codex-cloudomgeving geblokkeerd. De volledige keten is lokaal getest met het aangeleverde item en nagebootste HTTP-diensten; echte bronverbinding, projectmigratie, cron en e-mailaflevering moeten op de eigen omgeving worden gecontroleerd.

### 1. Database en deployment

Voer op het bestaande Supabase-project **alleen** `supabase/migrations/003_nevobo_matches.sql` uit in de SQL Editor. Start niet opnieuw met migratie 001. Migratie 003 voegt wedstrijdvelden, historie, meldingen, een verzendwachtrij en gecontroleerde functies toe. Bestaande leden, inschrijvingen en punten blijven behouden. De migratie is herhaalbaar zonder opgeslagen data te wissen. Wacht tot Vercel de nieuwe commit op `main` als Ready toont.

### 2. Alleen import: Vercel-instellingen

Resend is niet nodig om het wedstrijdprogramma op te halen. Laat `RESEND_API_KEY` en `NOTIFICATION_FROM_EMAIL` leeg zolang e-mail nog niet wordt gebruikt. De import blijft werken en appmeldingen worden opgeslagen; de app toont geen mailwaarschuwing of mailtestknop zonder volledige mailconfiguratie.

1. Controleer bij Vercel → Settings → Environment Variables → Production de bestaande `SUPABASE_SERVICE_ROLE_KEY` en `NEXT_PUBLIC_SUPABASE_URL` van het juiste Supabase-project.
2. Voeg voor de automatische taak `CRON_SECRET` toe: een willekeurig geheim van minimaal 32 tekens, bewaard in je wachtwoordmanager. Handmatig synchroniseren vereist dit geheim niet.
3. Controleer dat `NEXT_PUBLIC_SITE_URL` de vaste app-URL is. De server-sleutel en cron-token mogen nooit een `NEXT_PUBLIC_`-prefix krijgen.
4. Redeploy na het instellen van variabelen. Deel geheime waarden nooit in chat, broncode of SQL-bestanden.

### 3. Eerste import

1. Zorg dat onder Beheer het juiste actieve seizoen is ingesteld.
2. Open als admin of beheerder **Wedstrijden → Nu synchroniseren**. De import meldt hoeveel wedstrijden nieuw, gewijzigd of buiten het actieve seizoen zijn. Nieuwe wedstrijden buiten de datums van dit seizoen worden overgeslagen; bestaande wedstrijden en hun historie worden niet naar een ander seizoen verplaatst.
3. Controleer enkele wedstrijden tegen de bron, inclusief datum, Nederlandse tijd en locatie.
4. Optioneel: maak voor een toekomstige wedstrijd een gekoppelde fluitdienst aan. Na migratie 008 kies je eventueel het verantwoordelijke team. De standaardpunten komen uit Instellingen → Diensten; begin, locatie en vereiste bevoegdheid volgen de wedstrijd en het teamniveau. De planning gebruikt automatisch 90 minuten. Leden schrijven zich via Diensten in; beheerders kunnen een lid of team toewijzen.

### 4. Vieruurlijkse importtaak

Vercel Hobby ondersteunt geen vieruurlijkse native cron, daarom gebruikt deze app **Supabase Cron** voor de planning en Vercel voor de verwerking.

1. Open Vault in Supabase en maak een secret met naam `avv_nevobo_cron_secret`. Vul daar veilig exact dezelfde waarde in als `CRON_SECRET` in Vercel.
2. Voer daarna `supabase/nevobo_cron.sql` uit. Controleer daarin de app-URL als je een andere vaste URL gebruikt. Het script weigert activering zolang geen eerste geslaagde import of veilige token in Vault bestaat; het bevat zelf geen geheime waarden.
3. Het script registreert uitsluitend `avv-keistad-nevobo-import`: `0 */4 * * *` (elke vier uur, UTC). Andere jobs worden niet gewijzigd en er wordt geen mailtaak aangemaakt.
4. Controleer in Supabase Cron de uitvoeringen en bij HTTP-fouten de pg_net-responsen (`net._http_response`). Een geslaagde cron-SQL-opdracht bewijst alleen dat het HTTP-verzoek is ingepland; controleer ook de HTTP-status en de laatste succesvolle import in de app. Meer dan vijf uur zonder succesvolle import geeft een waarschuwing. De planning gebruikt UTC: in Nederland zijn de runs in de winter om 01:00, 05:00, 09:00, 13:00, 17:00 en 21:00; in de zomer één uur later.

De cron-token staat alleen in Vercel en Vault; de SQL-job verwijst naar de Vault-naam. Het endpoint `/api/nevobo/sync` weigert verzoeken zonder de juiste bearer-token. Een importlease voorkomt gelijktijdige imports; een defecte of tegenstrijdige bron wordt niet gedeeltelijk toegepast.

### 5. Later optioneel: Resend en e-mailmeldingen

1. Maak een account aan op https://resend.com en voeg een eigen afzenderdomein toe. Voer de door Resend opgegeven DNS-records in bij de domeinbeheerder en wacht op verificatie.
2. Maak een API-key met verzendrechten voor het geverifieerde domein.
3. Voeg in Vercel bij Production `RESEND_API_KEY` en `NOTIFICATION_FROM_EMAIL` toe. Het afzenderadres moet op het geverifieerde domein staan, alleen het e-mailadres (geen weergavenaam). Controleer ook `NEXT_PUBLIC_SITE_URL` en redeploy. Vanaf dit moment kan de import ook klaargezette wijzigingsmails afleveren; opgeslagen mailberichten worden behouden zolang e-mail nog uitstaat.
4. Klik als beheerder **Wedstrijden → Testmelding naar mij**. Deze expliciete test verstuurt uitsluitend naar het e-mailadres van je eigen ingelogde beheeraccount en plaatst een echte testmelding in je eigen app-inbox. Er worden geen wedstrijdgegevens aangepast. Controleer Meldingen en je mailbox/spammap. Een API-acceptatie door Resend bewijst op zichzelf nog geen ontvangst in de inbox.
5. Voer pas daarna `supabase/nevobo_mail_cron.sql` uit. Dit voegt de afzonderlijke job `avv-keistad-nevobo-mail` toe voor de mailwachtrij, elke minuut. Dezelfde Vault-token wordt gebruikt; de wedstrijdbron wordt hierbij niet opgehaald. Het endpoint `/api/nevobo/notifications` vereist dezelfde bearer-token.

Als de eerdere versie van het cronbestand de mailtaak al heeft aangemaakt, blijft die taak behouden. Zonder Resend-configuratie verstuurt deze geen mail; desgewenst kan alleen `avv-keistad-nevobo-mail` in Supabase Cron worden uitgeschakeld.

### Wedstrijd- en meldingsgedrag

- Elke gewijzigde begintijd of locatie werkt de gekoppelde fluitdienst bij en bewaart de toewijzing en puntenwaarde. Zelf ingestelde diensttitels blijven behouden; automatisch gegenereerde teamtitels bewegen mee met een gewijzigde tegenstander.
- De betrokken scheidsrechters ontvangen een appmelding en, wanneer Resend is ingesteld, een e-mail via de wachtrij. Vorige en nieuwe datum/tijd en locatie worden vermeld. Vergrendeling en unieke wijzigings-ID's voorkomen gemiste toewijzingen tijdens inschrijven en dubbele meldingen bij dezelfde import.
- `afgelast` sluit de dienst en laat de punten vervallen, met behoud van historie. Herstel door de bron kan een bronannulering terugdraaien; een handmatige annulering door beheer wordt niet ongedaan gemaakt.
- Zodra een wedstrijd begint, kan niemand meer inschrijven, ook tussen twee imports en via een directe databaseactie. ‘Gespeeld’ wordt uitsluitend gebruikt bij een expliciete bronstatus; een verstreken tijd heet ‘Afgelopen’ en staat onder Historie.
- Verdwijnt een toekomstige wedstrijd uit een volledig, succesvol gelezen niet-leeg programma, dan wordt de status ‘niet bevestigd’: inschrijven en puntentoekenning worden geblokkeerd en de toegewezen scheidsrechter krijgt bericht. Dit wordt niet zonder bronbewijs een afgelasting genoemd. Een lege of foutieve feed annuleert niet massaal wedstrijden.
- Bij mailproblemen blijven appmeldingen bestaan. Er zijn maximaal tien afleverpogingen met backoff, claims en vaste idempotentiesleutels. Na permanente fouten zijn de codes zichtbaar voor beheer in de outbox; herstel dan de mailconfiguratie en laat de betreffende mislukte berichten opnieuw inplannen. De taak garandeert niet dat een extern mailadres het bericht accepteert of niet als spam behandelt.

`npm test` controleert de echte migratie, rollen, wijzigingshistorie, verplaatsing, afgelasting, inschrijfstop, mailtransport en de parser met de aangeleverde RSS-items, inclusief club-/sponsorstreepjes aan beide kanten, vervallen wedstrijden, concepten en zomer-/wintertijd. `npm run test:browser` controleert ook de volledige HTTP-keten met uitsluitend lokale Nevobo-/Resend-testdiensten; de netwerkpreloader staat alleen onder scripts en wordt nooit door de productie-app geïmporteerd.

## Seizoenen aanmaken en aanpassen

Voer op een bestaand project uitsluitend `supabase/migrations/004_season_management.sql` uit in de Supabase SQL Editor en wacht op de bijbehorende Vercel-deployment. Voer de initiële migratie niet opnieuw uit. De nieuwe migratie bewaart alle bestaande seizoen-ID's, teamindelingen, diensten, inschrijvingen, wedstrijden en functiepunten; zij voegt een versietijdstip en beperkte beheerfuncties toe. De migratie is herhaalbaar. Zonder deze migratie toont het seizoenscherm een uitleg en wordt geen bewerkformulier aangeboden.

- Open als admin of beheerder **Beheer → Seizoenen**. Selecteer **Bewerken** om naam, begin/einddatum en de algemene, jeugd- en seniorennorm te wijzigen. Bewerkingen richten zich op de geselecteerde ID, ook bij een inactief seizoen.
- Kies **Nieuw seizoen** voor een apart seizoen. Als er een eerder seizoen bestaat, worden datums één jaar doorgeschoven en normen als aanpasbaar voorstel overgenomen. Een herkenbare naam zoals `2026/2027` wordt voorgesteld als `2027/2028`. Zonder brongegevens blijven de velden leeg. Teamindelingen, diensten en functies worden niet gekopieerd.
- Jeugd/senioren leeg laat de algemene norm gelden; **0** geeft vrijstelling. Persoonlijke normen blijven voorgaan. Een gewijzigde norm past het puntendoel aan en verandert geen reeds toegekende punten.
- Het eerste seizoen wordt actief als er nog geen actief seizoen is. Een volgend seizoen blijft apart opgeslagen. **Activeren** vraagt een bevestiging omdat ledenoverzichten, beheer en Nevobo-import daarna dat seizoen gebruiken. Oude gegevens blijven aan hun oorspronkelijke seizoen gekoppeld.
- Een wijziging van de periode mag bestaande niet-geannuleerde diensten, wedstrijden en functietoekenningen niet buiten de datums plaatsen. De app bewaart je invoer en geeft uitleg wanneer dit gebeurt. Datums worden in Nederlandse tijd gecontroleerd; een dienst mag exact om middernacht na de laatste seizoensdag eindigen.
- Als een andere beheerder hetzelfde seizoen intussen heeft aangepast, wordt opslaan/activeren geweigerd totdat je herlaadt. Gelijktijdige schrijfoperaties worden geserialiseerd; er is maximaal één actief seizoen. Een oud formulier zonder expliciete seizoen-ID vraagt om herladen in plaats van het inmiddels actieve seizoen onbedoeld te overschrijven.

Beheerrechten worden ook in de database gecontroleerd; leden en anonieme bezoekers kunnen geen seizoenen schrijven. De tests voeren migratie 004 op echte lokale PostgreSQL-tabellen uit, controleren rechten, behoud van bestaande gegevens, versieconflicten en activatie. De browsercontrole gebruikt uitsluitend lokale testgegevens en controleert ook opslaan/herladen, eerste/volgende seizoen, fouten met invoerbehoud en responsieve weergave.

## Wedstrijden filteren

Op **Wedstrijden** kunnen leden en beheerders **Dag**, **Team**, **Locatie** en **Status** combineren en met **Filteren** toepassen. De dag is een Nederlandse kalenderdag; een team wordt zowel thuis als uit gevonden. Gelijknamige locaties worden per plaats onderscheiden. Opties komen uit de daadwerkelijk geïmporteerde wedstrijden van het actieve seizoen.

**Programma** toont komende wedstrijden, **Historie** afgelopen/gespeelde wedstrijden en **Alle wedstrijden** beide. Filters blijven behouden bij wisselen van tab en bij pagineren; een nieuw filter begint op pagina 1. **Filters wissen** wist de selectie binnen de huidige tab. De zichtbare status en het statusfilter komen overeen: ‘Afgelopen’ betekent dat de begintijd verstreken is, ‘Gespeeld’ vereist een bevestigde bronstatus. Dit verandert geen inschrijfregels of planning. Er is voor de filters geen nieuwe databasemigratie nodig.

## Nevobo-wijzigingslog bekijken

Admin en beheerder schakelen **Beheermodus** in en openen **Wedstrijden → Wijzigingslog**. De bestaande `match_events`-historie uit migratie 003 wordt hier weergegeven; er is geen nieuwe migratie nodig. Bij Wedstrijddetails staat ook **Wijzigingshistorie bekijken** voor uitsluitend die wedstrijd.

Het log vergelijkt vastgelegde vorige/nieuwe begintijd, thuis-/uitteam, locatie, adres, postcode, plaats, veld en status. Het tijdstip is het moment waarop de app de wijziging vastlegde, niet het onbekende moment waarop Nevobo de bron wijzigde. De wedstrijdnaam komt uit de historische momentopname. De lijst bevat wijzigingen uit alle seizoenen, is filterbaar op soort/wedstrijd en heeft 25 momenten per pagina. Bestaande beheer-RLS blijft gelden; leden kunnen het wijzigingslog niet lezen en de app kan geen logregels handmatig aanpassen.

Bovenaan staan de laatste geslaagde import, aantallen nieuwe/gewijzigde wedstrijden en een eventuele laatste fout. Het log bevat wijzigingen aan bestaande wedstrijden. Eerste imports/nieuw toegevoegde wedstrijden staan in de importteller, zonder verzonnen vorige waarden. Een onveranderde import maakt geen wijzigingsregels aan: de laatste succesvolle importtijd schuift wel op. Volledige uitvoeringshistorie van de automatische taak staat bij Supabase Cron; HTTP-responsen bij pg_net. Het wijzigingslog werkt ook zonder Resend.

## Scheidsrechtersniveaus instellen

Voer op het bestaande project `supabase/migrations/005_referee_qualifications.sql` uit nadat migratie 003 is toegepast. Herhaal migratie 001 niet. De migratie voegt expliciete codes toe, bewaart bestaande numerieke gegevens en inschrijvingen en is herhaalbaar. Omdat de eerdere schaal 0–10 geen vastgelegde koppeling met diploma's had, krijgen bestaande leden/diensten niet automatisch een opleidingscode.

De volgorde is **V6 < V4 < R2.2 < R2 < R1 < N3 < N2 < N1**. Een lid kan een fluitdienst doen met een vereist niveau gelijk aan of lager dan het eigen ingestelde niveau. Een onbekend/niet-ingesteld niveau geeft geen fluitbevoegdheid. Andere diensttypen blijven hun bestaande controles gebruiken.

Beheerders kiezen bij **Beheermodus → Leden → Lid instellen** het behaalde scheidsrechtersniveau. ‘Niet ingesteld’ is een ontbrekende bevoegdheid, geen extra niveau; zo kan een lid zonder scheidsrechtersopleiding wel een teamindeling krijgen. Kies bij algemene fluitdiensten expliciet een vereist niveau. Vanaf migratie 006 krijgen gekoppelde wedstrijddiensten onder promotieklasse hun minimum automatisch uit het teamniveau; vanaf promotieklasse wordt geen clubdienst aangemaakt. Algemene bestaande fluitdiensten krijgen hun minimum onder **Beheermodus → Planning → Planning beheren → Vereist niveau → Niveau opslaan**. Stel na de migratie de juiste codes voor bestaande scheidsrechters en diensten eenmalig in.

Dezelfde volgorde wordt gecontroleerd bij inschrijven, teamtoewijzing en overname, ook via directe of oudere RPC-aanroepen. Leden kunnen hun eigen niveau niet verhogen. Migratie 005 bewaart bestaande inschrijvingen en behaalde punten; aanbieden/afmelden en correcties blijven mogelijk volgens de bestaande regels. Migratie 006 controleert toekomstige toewijzingen opnieuw volgens de clubregels hieronder. De oude cijferkolommen blijven voor compatibiliteit bestaan; na een expliciete codekeuze gebruikt de app een overeenkomende interne rang. Die cijfers zijn geen diploma's en worden niet als opleidingsniveau getoond.


## Excel-teams en automatische fluitregels (006)

De op 9 november 2026 aangeleverde `Keistad-teams.xlsx` is de bron voor de 57 teams en competitieniveaus. De leesbare gegevens staan in `supabase/data/keistad-teams.csv`; de bronhash staat in `supabase/import_keistad_teams.sql`. Lege cellen blijven leeg, waaronder L2–L5 en XZ; leeftijdsgroep wordt afgeleid uit de teamcode (HS/DS/XZ senior, JA/JB/JC/MA/MB/MC/L2–L5 jeugd). Er wordt geen wedstrijdcode gebruikt om een ingevuld teamniveau te overschrijven.

Voer in de Supabase SQL Editor eerst `supabase/migrations/006_competition_referee_rules.sql` uit, daarna **het volledige** `supabase/import_keistad_teams.sql`. Hiervoor moeten 003 en 005 al zijn toegepast; voer 001 niet opnieuw uit. Wacht op de bijbehorende Vercel-deployment. Deze codewijziging voert de scripts niet op de live database uit.

Het importscript vervangt uitsluitend de teams van het **actieve seizoen** door exact de 57 Excel-teams, met nieuwe team-ID's. Teams van andere seizoenen blijven bestaan. Het script vergrendelt de relevante tabellen, bewaart een momentopname van oude teams, lidindelingen en teamreserveringen in `audit_log` (`replace_teams_from_excel`) en koppelt herkenbare oude teams aan de nieuwe ID's. Sponsornamen en interne namen zoals ‘Heren 1’, ‘Dames 2’, ‘HS 1’ worden herkend. Aanvoerderschap, persoonlijke norm, leden, diensten, functiepunten en inschrijvingshistorie blijven behouden. Een oud team dat niet herkend wordt maar wel leden of gereserveerde diensten heeft, stopt **de volledige transactie zonder verwijdering** met de betreffende teamnamen. Hernoem zulke teams eerst naar hun juiste Excel-teamnaam en voer het script opnieuw uit. Niet-herkende, ongebruikte teams worden verwijderd. Herhalen maakt geen dubbele teams, maar vervangt opnieuw de actieve lijst en zet de niveaus terug op de Excel-waarden.

| Competitie | Minimum |
|---|---|
| Promotieklasse en hoger (ook Superdivisie, Topdivisie, eerste/tweede/derde divisie) | Geen clubscheidsrechter nodig |
| Senioren eerste/tweede klasse | V4 |
| Jeugd hoofdklasse | V4 |
| Overige en lege Excel-niveaus | V6 |

Vanaf promotieklasse, inclusief alle divisies, worden geen clubdiensten aangemaakt. Dit geldt voor 6 Excel-teams (HS 1–3 en DS 1–3). De overige 51 teams vallen onder clubregels: 11 met minimum V4 en 40 met V6. De interne niveaugrenzen N2/R1/R2 dienen uitsluitend om de uitsluiting vast te stellen, niet om hiervoor clubdiensten te maken. Een hoger ingesteld diploma voldoet ook; een niet-ingesteld diploma geeft geen fluitbevoegdheid.

**Beheer → Teams en niveaus** toont alle teams van het actieve seizoen en laat beheerders het competitieniveau aanpassen. Wedstrijden vanaf promotieklasse tonen **Geen clubscheidsrechter nodig** en bieden geen aanmaakactie. Alle schrijfwegen, ook oudere RPC’s met een N1-keuze, weigeren hiervoor clubdiensten. Bij wedstrijden daaronder is het minimum automatisch en niet handmatig te verlagen. Sponsoring verandert de teamidentiteit niet. Ook een uitwedstrijd wordt gekoppeld aan het Keistad-team; bij twee Keistad-teams geldt het hoogste minimum. Een ontbrekend of dubbelzinnig team sluit aanmaken/inschrijven, in plaats van terug te vallen op V6. Algemene, niet aan een wedstrijd gekoppelde fluitdiensten houden een expliciet gekozen minimum; een gereserveerd vrijwilligersteam is niet het spelende team.

Database-triggers beschermen ook oude RPC's, directe toewijzingen door een beheerder/aanvoerder en overnames. Teamniveau- en bronnaamwijzigingen herberekenen toekomstige wedstrijddiensten; een diploma-aanpassing controleert bestaande toekomstige fluittoewijzingen opnieuw. Een toewijzing met een te laag of onbekend niveau wordt ingetrokken met een vastgelegde reden, een appmelding aan het lid en `referee_requirement_revoke` in `audit_log`. Een bestaande toekomstige clubdienst vanaf promotieklasse wordt geannuleerd, de bijbehorende toekomstige toewijzingen worden ingetrokken met melding **Clubfluitdienst vervallen** en auditactie `club_referee_not_needed`; de wedstrijd zelf blijft in het programma. Ook bij een latere promotie van een team werkt dit door. Geannuleerde clubdiensten worden niet automatisch heropend bij een latere degradatie; beheer kan dan een nieuwe clubdienst maken met de actuele regel. Er worden hiervoor geen automatische e-mails verstuurd. Bij een mislukte overname blijft de oorspronkelijke toewijzing behouden. Afgelopen diensten en behaalde punten blijven staan; verloren toekomstige planning telt niet als behaald. De eerste herberekening gebeurt atomair aan het einde van de teamimport, zodat een half vervangen teamlijst niet tot onterechte intrekkingen leidt.


## Beheermodus en dashboard

Admin en beheerder gebruiken de schakelaar **Beheermodus** linksonder om naar het beheerdashboard te gaan. Dezelfde schakelaar brengt hen terug naar de ledenomgeving. De stand volgt de URL en blijft dus correct na herladen, directe links of terugnavigeren. Mobiel staat de schakelaar onderaan het navigatiemenu. Een lid of aanvoerder zonder beheerrol krijgt deze toegang niet.

| Menuonderdeel | Beheer |
|---|---|
| Dashboard | Actief seizoen, actuele aantallen, open plaatsen en opvolglinks |
| Leden | Zoekfunctie, teamindeling, diploma, norm en functies/groepen toewijzen; uitnodigen uitsluitend voor admin |
| Teams | Teams toevoegen, competitieniveaus en fluitregels |
| Planning | Diensten/reeksen aanmaken, toewijzen, annuleren en inschrijvingen corrigeren |
| Wedstrijden | Nevobo-programma, synchroniseren, clubfluitdiensten en wijzigingslog |
| Functies | Losse functies aanmaken/bewerken en functies of functiegroepen toewijzen |
| Functiegroepen | Groepen, vaste seizoenpunten en groepsleden beheren |
| Rapportage | Punten, tekorten, teamfilter en CSV-export |
| Seizoenen | Aanmaken, bewerken en activeren van seizoenen |
| Instellingen | Huisstijl en toegang tot wedstrijd-/seizoensinstellingen |

De beheerpagina's staan onder `/beheer`. Het ledenmenu gebruikt `/`, `/diensten`, `/mijn-diensten` en `/profiel`, met `/team` uitsluitend voor aanvoerders. Meldingen zijn bereikbaar via de topbar; directe links naar het wedstrijdprogramma blijven bruikbaar. Het ledenprogramma toont ook voor beheerders geen beheeracties; deze staan in `/beheer/wedstrijden`. Het oude `/wedstrijden/log` blijft bruikbaar als verwijzing naar het beveiligde beheerlog. Formulieren blijven na opslaan in hun beheeronderdeel; lidinstellingen houden de geselecteerde persoon vast. De bestaande rollen, SQL/RLS-controles, punten en fluitregels wijzigen niet. Hiervoor is geen nieuwe databasemigratie nodig.


## Leden en aanvoerders

Leden gebruiken een compact menu: **Mijn overzicht**, **Open diensten**, **Mijn diensten** en **Mijn profiel**. De startpagina toont de eigen puntenstand, komende eigen diensten en passende open diensten. De dienstkeuze houdt rekening met teamreserveringen, bevoegdheid, bestaande inschrijvingen, overlap en vrije plaatsen/overname. De bestaande backendcontroles blijven doorslaggevend.

Mijn diensten heeft een komende planning en een afgelopen overzicht voor het actieve seizoen. Dit bevat uitsluitend eigen inschrijvingen; een opgegeven lid-ID in de URL verandert de identiteit niet. Geannuleerde en ingetrokken inschrijvingen blijven zichtbaar met nul punten. Mijn profiel toont uitsluitend de eigen gegevens en norm; leden kunnen hun diploma, rol of puntennorm daar niet verhogen. De bestaande wachtwoordinstelling na uitnodiging of herstel opent via het profiel. Het oude `/diensten?view=mine` verwijst door naar Mijn diensten.

Een aanvoerder krijgt **Mijn team** voor de stand van het eigen team en het verdelen van aan dat team toegewezen diensten. Alleen beschikbare, bevoegde eigen teamleden kunnen worden gekozen. Na toewijzen blijft het scherm op Mijn team. Een beheerrol op zichzelf geeft geen extra teams in deze ledenweergave; uitgebreid teambeheer blijft beschikbaar in Beheermodus. De database beschermt ook tegen een handmatig aangepast lid- of dienst-ID. Hiervoor is geen nieuwe databasemigratie nodig.

## Diensten aan teams toewijzen en standaardpunten (008)

Voer `supabase/migrations/008_team_duties_and_referee_defaults.sql` uit in de **Supabase-database die deze app gebruikt**, na 003, 005 en 006. Voer 001 niet opnieuw uit. De migratie is herhaalbaar en verandert geen bestaande diensten, inschrijvingen of punten. Zonder 008 blijven bestaande diensten zichtbaar; de nieuwe aanmaak-, team- en puntenfuncties zijn pas beschikbaar na de migratie.

- **Beheer → Instellingen → Diensten**: stel de standaardpunten per fluitbeurt in (initieel 2; stappen van 0,25). De instelling geldt voor nieuwe algemene en wedstrijdfluitdiensten, per deelnemer. Bestaande diensten houden hun vastgelegde punten, ook na een latere wijziging van de instelling. Voor overige diensten blijft 1 uur = 1 punt gelden.
- **Beheer → Wedstrijden**: maak een fluitdienst aan en kies eventueel een team. Punten en duur hoeven niet ingevuld te worden. De database leest de actuele standaardpunten, gebruikt de bestaande planning van 90 minuten en bepaalt het vereiste diploma uit de wedstrijdteams. Vanaf promotieklasse blijft een clubfluitdienst uitgesloten. Bij een bestaande gekoppelde fluitdienst kun je het verantwoordelijke team wijzigen.
- **Beheer → Planning**: kies een team bij een nieuwe dienst of wijzig bij een bestaande toekomstige open dienst de teamkeuze met **Team opslaan**. **Open voor alle teams** heft de reservering op. Een teamkeuze reserveert de dienst voor dat team; zij schrijft niet alle teamleden in en kent geen punten aan het hele team toe. De aanvoerder verdeelt de dienst via **Mijn team** aan een bevoegd eigen teamlid.

Een team moet bij hetzelfde seizoen horen. Wisselen naar een team met ingeschreven deelnemers buiten dat team wordt geweigerd; bestaande inschrijvingen worden nooit stilzwijgend ingetrokken. Trek die inschrijvingen zo nodig eerst bewust in bij Inschrijvingen corrigeren. Diploma, capaciteit, overlappende diensten, inschrijfsluiting en aanvoerdersrechten blijven beschermd door de database. Het verantwoordelijke vrijwilligersteam verandert het vereiste diploma van een wedstrijd niet.

`save_duty_settings` en `assign_duty_team` worden vastgelegd in `audit_log`. De nieuwe RPC’s controleren beheerrechten en accepteren bij wedstrijdfluitdiensten uitsluitend wedstrijd- en eventueel team-ID. De eerdere RPC’s blijven bestaan voor compatibiliteit; de app gebruikt de nieuwe standaardpuntenfuncties. De database- en browsertests controleren opslag/herladen, gegevensbehoud, teamwissels, onbevoegde verzoeken en mobiele bediening met lokale testgegevens.

## Handmatig aangevraagde testleden

`scripts/seed-test-members.sql` is een afzonderlijk testdatabestand, geen migratie en geen onderdeel van de productie-app of deployment. Voer het volledige bestand handmatig uit in de Supabase SQL Editor van de bedoelde database. Er moet een actief seizoen met teams zijn en migratie 005 moet zijn uitgevoerd.

Het script vult ieder team van het actieve seizoen aan tot 8–12 leden. Teams die al 8–12 leden hebben worden nooit verkleind. De namen zijn verzonnen, de e-mailadressen eindigen op `@example.test` en de unieke fictieve Nevobo-codes beginnen met `TEST`. Nieuwe accounts krijgen uitsluitend de rol `member`, een willekeurig verdeeld niveau uit V6/V4/R2.2/R2/R1/N3/N2/N1 en een bijbehorende interne rang. Ieder team krijgt precies één aanvoerder; een reeds aanwezige aanvoerder blijft behouden. Bestaande leden, wachtwoorden, inschrijvingen, punten en teamreserveringen worden niet overschreven. Meer dan 12 bestaande leden of meerdere bestaande aanvoerders veroorzaken een fout zonder gedeeltelijke import.

De Supabase Auth-gebruikers én hun e-mailidentities worden aangemaakt; `email_confirmed_at` en `email_verified` worden direct ingesteld. Er worden geen uitnodigings- of bevestigingsmails verstuurd. De bestaande profieltrigger maakt het app-profiel. Na afloop verschijnt een overzicht per team met aantallen en aanvoerder. Opnieuw uitvoeren voegt bij ongewijzigde roosters niets toe. De actie wordt zonder wachtwoord vastgelegd als `seed_test_members` in `audit_log`. Via `auth.users.raw_user_meta_data.seed_source = 'keistad-test-members-v1'` blijven de gegenereerde accounts herkenbaar.

### Ook inloggen als een testlid

Zonder extra instelling hebben de nieuwe accounts geen wachtwoord; ze zijn wel bevestigd en bruikbaar voor de ledenadministratie en planning. Voor inloggen met testaccounts kies je zelf een testwachtwoord van minimaal 12 tekens. Zet onderstaande opdracht **bovenaan hetzelfde SQL Editor-venster**, gevolgd door het volledige testdatabestand, en voer alles samen uit. Vervang de drie puntjes door jouw eigen testwachtwoord; de voorbeeldwaarde wordt geweigerd. Deel het wachtwoord niet in de chat en sla het niet op in de repository.

```sql
select set_config('avv.test_member_password', '...', false);
```

Deze optionele instelling gebruikt de bestaande Supabase-extensie `pgcrypto` om alleen voor **nieuwe** testaccounts een wachtwoordhash te maken. De sessie-instelling wordt na een succesvolle import gewist; herhalen reset geen bestaande wachtwoorden. Kies deze optie dus bij de eerste import als je met de dummyaccounts wilt inloggen. Het overzicht na afloop toont de aanvoerdersadressen; de overige testadressen staan onder Beheer → Leden. De tests controleren SQL/identities, e-mailbevestiging, UUID-formaat, wachtwoordhash, alle 57 teams, rechten, veilig herhalen en rollback met uitsluitend lokale testdata. Er worden daarmee geen live gebruikers aangemaakt of live aanmeldingen bevestigd.

## Functies en functiegroepen (009)

Voer `supabase/migrations/009_function_groups.sql` uit in de Supabase-database van deze app. Deze migratie bouwt voort op 001; voer 001 niet opnieuw uit. Zij bewaart bestaande vrije functietoekenningen inclusief punten en periode. Groepen, losse functies en toewijzingen zijn per seizoen; er wordt geen fictieve catalogus aangemaakt en niets automatisch naar een volgend seizoen gekopieerd.

- **Beheer → Functiegroepen**: maak een groep aan met een naam en vaste punten per lid per seizoen. Na opslaan staat die groep open om leden toe te voegen. Via Beheren kun je de naam/punten aanpassen, groepsleden bekijken, meerdere leden zoeken/selecteren/toevoegen en een lid uit de groep verwijderen.
- **Beheer → Functies**: maak losse functies aan of bewerk ze. In het toewijsformulier kies je een lid met een teamindeling in het actieve seizoen en daarna een functie of functiegroep. Punten en datums worden uit de gekozen instelling en het seizoen overgenomen.
- **Beheer → Leden → Functie toewijzen** (ook onder Instellen): het geselecteerde lid krijgt onder zijn instellingen hetzelfde keuzemenu met Functies en Functiegroepen. Daar staan ook de bestaande toekenningen van dat lid, die je afzonderlijk kunt intrekken. Na opslaan blijft het juiste lid geselecteerd.

Groepslidmaatschap wordt als één gekoppelde regel in `function_assignments` opgeslagen; er is geen tweede, losstaande puntentoekenning. Een lid krijgt dezelfde functie of groep maximaal één keer per seizoen, ook bij dubbel klikken of toewijzen via verschillende schermen. Een lid kan meerdere verschillende functies en groepen hebben; hun punten tellen op in het bestaande persoonlijke/teamoverzicht en de rapportage. De app haalt ook meer dan 1000 toekenningen volledig op.

Een gewijzigde naam of puntenwaarde werkt door naar alle gekoppelde toekenningen van die functie/groep in hetzelfde seizoen. Andere seizoenen en oudere vrije toekenningen worden niet bijgewerkt. Uit een groep verwijderen trekt alleen die groepspunten in, zonder een losse functie of andere groep te wijzigen. Een functie of groep geeft geen beheerrechten.

De database controleert beheerrechten, een teamindeling in hetzelfde seizoen, de gekozen bron en unieke toewijzing. De punten en periode van gekoppelde regels zijn ook bij directe SQL-wijzigingen afgeleid van de bron; een aangeboden puntenwaarde kan die niet overschrijven. Toevoegen van meerdere groepsleden is atomair: een ongeldige keuze draait de hele toevoeging terug. Gewone leden lezen uitsluitend eigen toekenningen; aanvoerders lezen daarnaast hun eigen team volgens de bestaande RLS. Opslaan, toewijzen en intrekken worden gelogd. Migratie 009 is herhaalbaar en maakt geen voorbeeldgroepen of voorbeeldfuncties.

Zonder 009 blijven bestaande ledeninstellingen en punten leesbaar; de nieuwe toewijs-/beheerformulieren tonen een migratiemelding en zijn uitgeschakeld. Database- en browsercontroles gebruiken uitsluitend lokale testgegevens en controleren punten, rechten, gegevensbehoud, selectie/herladen, beide toewijsroutes, dubbele toekenningen, foutterugval en mobiele bediening.

## Bijgewerkte divisiegrenzen (010)

Voer `supabase/migrations/010_division_referee_levels.sql` uit na 006 in de database van de app. Superdivisie, Topdivisie, Eerste en Tweede divisie vereisen N2 of N1; Derde divisie vereist R1 of hoger en Promotieklasse R2 of hoger. Vanaf promotieklasse blijven clubfluitdiensten uitgesloten. Bestaande inschrijvingen en punten blijven behouden. Aanvoerders zien competitietekst bij de licentie.

## Diensten per datum en deelnemers (011)

Voer `supabase/migrations/011_duty_participants.sql` uit in de database van de app, na 001. Open diensten toont alle komende niet-geannuleerde diensten per uitklapbare datum, met combineerbare team- en typefilters. Volle diensten en de ingeschreven leden blijven zichtbaar. De beperkte RPC geeft uitsluitend voor komende diensten van het actieve seizoen de voor- en achternamen van actieve inschrijvingen terug aan ingelogde leden. Profiel-, e-mail- en inschrijfhistorie blijven onder bestaande RLS. Inschrijfbevoegdheden veranderen niet.

## Fluitdiensten voor een periode (012)

Voer `supabase/migrations/012_match_duty_period.sql` uit na 008 en 010. Beheer → Wedstrijden biedt Vanaf en Tot en met (beide inbegrepen, Europe/Amsterdam) en Fluitdiensten aanmaken. De actie gebruikt alle thuiswedstrijden van het actieve seizoen in die periode, onafhankelijk van zichtbare filters of pagina. Geplande toekomstige wedstrijden onder Promotieklasse krijgen een dienst met de ingestelde standaardpunten, 90 minuten en automatisch niveau, open voor alle teams. Bestaande diensten (ook geannuleerde) worden overgeslagen; onbekende teams en niet-beschikbare wedstrijden worden afzonderlijk geteld. De database controleert beheerrechten, vergrendelt wedstrijden tegen dubbele gelijktijdige aanmaak en schrijft de tellingen naar audit_log. De hele actie is één transactie; herhalen maakt geen dubbele actieve diensten.

## Dienstenmenu en overige diensten (013)

Beheer heeft een uitklapbaar Diensten-menu met Wedstrijden, Bardiensten, Evenementen, Overige diensten en Planning. De drie aanmaakpagina’s gebruiken dezelfde bestaande puntenberekening (1 uur = 1 punt per deelnemer), weekreeksen en teamreservering. Overige diensten krijgen een zelfgekozen titel en soort `other`. Voer `supabase/migrations/013_other_duties.sql` uit om deze extra soort toe te staan; bestaande diensten worden behouden. De bestaande beheerrollen blijven vereist.
