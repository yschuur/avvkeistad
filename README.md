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

- **Nevobo-koppeling:** geïmplementeerd met parser, wijzigingshistorie, appmeldingen en Resend. Activering van de import vereist migratie 003, een eerste gecontroleerde import en Supabase Cron; Resend is optioneel en kan later worden ingesteld; zie de activatiestappen hieronder. De volledige live bronverbinding en echte e-mailaflevering zijn nog niet vanuit deze ontwikkelomgeving geverifieerd.
- De gebruiker heeft een werkende live login bevestigd. Uitnodigingen, SMTP en nieuwe migraties moeten nog op het eigen project worden gecontroleerd; de ontwikkeltests gebruiken een lokale testbackend.
- Wijzigingsmeldingen voor gekoppelde scheidsrechters zijn ingebouwd. Bij verplaatsing blijft de toewijzing behouden; de scheidsrechter moet controleren of de nieuwe planning past. Algemene dienstherinneringen buiten deze wedstrijdmeldingen zijn nog niet ingebouwd.
- Scheidsrechtersniveaus zijn voorlopig genummerd 0–10. De concrete Nevobo-opleidingen en toegestane competities moeten aan deze niveaus worden gekoppeld voordat automatische fluitdiensten actief worden.
- De eerste versie beheert één actief seizoen; een apart seizoenarchief en seizoenwisselscherm volgen. Rapportage bevat nu team- en tekortfilters en CSV; uitgebreide periode-/functie-/dienstfilters volgen.
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

## Huisstijl en designsysteem

`DESIGN_SYSTEM.md` is de centrale standaard; `AGENTS.md` verplicht hergebruik ervan. De app gebruikt neutrale tokens en compacte lijsten/tabellen. Er is geen automatische demo-inhoud.

Voer op een bestaand project uitsluitend `supabase/migrations/002_club_branding.sql` uit om de huisstijlopslag toe te voegen. Op een nieuw project eerst 001, daarna 002. Migratie 002 voegt alleen een singleton-huisstijltabel, leesbeleid en beveiligde opslagfunctie toe; bestaande kleuren worden bij herhaald uitvoeren niet overschreven. Bestaande leden, rollen, punten en diensten blijven intact.

Admin en beheerder vinden de editor onder **Beheer → Instellingen → Huisstijl** (`/beheer/instellingen/huisstijl`). Primaire en secundaire kleur hebben een color picker en HEX-invoer met directe lokale preview. Opslaan maakt de kleuren clubbreed beschikbaar, ook na herladen/inloggen. Standaardkleuren herstellen vult de bestaande applicatiedefaults in; druk daarna op Opslaan. Voorgronden en focuskleuren worden automatisch aangepast voor contrast.

Alleen kleuren zijn publiek leesbaar; de identiteit van de editor is niet publiek uitleesbaar. Alleen admin/manager kan via de opslagfunctie schrijven. De app behoudt standaardkleuren als de migratie nog ontbreekt of de instelling niet kan worden opgehaald. De editor meldt dit en schakelt Opslaan uit. Na toepassen van de migratie de pagina herladen. Publieke kleurgegevens hebben een cache van 60 seconden; opslaan wist de cache direct.

`npm test` test onder meer de nieuwe migratie met daadwerkelijke PostgreSQL-rechten en kleurcontrast voor een RGB-steekproef. `npm run test:browser` en `npm run test:performance` gebruiken dezelfde lokale integratiesuite, inclusief huisstijlpreview, bewaren/herladen/reset, mobiele navigatie en bestaande auth-/herstelflows. `SCREENSHOT_DIR` kan een uitvoermap voor screenshots van uitsluitend deze testomgeving instellen.

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
4. Optioneel: maak voor een toekomstige wedstrijd een gekoppelde fluitdienst aan. Kies punten, geplande duur en vereiste bevoegdheid expliciet; deze waarden worden niet geraden uit de wedstrijdcode. Leden schrijven zich via Diensten in; beheerders kunnen via Beheer een lid toewijzen.

### 4. Vieruurlijkse importtaak

Vercel Hobby ondersteunt geen vieruurlijkse native cron, daarom gebruikt deze app **Supabase Cron** voor de planning en Vercel voor de verwerking.

1. Open Vault in Supabase en maak een secret met naam `avv_nevobo_cron_secret`. Vul daar veilig exact dezelfde waarde in als `CRON_SECRET` in Vercel.
2. Voer daarna `supabase/nevobo_cron.sql` uit. Controleer daarin de app-URL als je een andere vaste URL gebruikt. Het script weigert activering zolang geen eerste geslaagde import of veilige token in Vault bestaat; het bevat zelf geen geheime waarden.
3. Het script registreert uitsluitend `avv-keistad-nevobo-import`: `0 */4 * * *` (elke vier uur, UTC). Andere jobs worden niet gewijzigd en er wordt geen mailtaak aangemaakt.
4. Controleer in Supabase Cron de uitvoeringen en bij HTTP-fouten de pg_net-responsen (`net._http_response`). De importstatus en de laatste succesvolle import staan in de app. Meer dan vijf uur zonder succesvolle import geeft een waarschuwing.

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
