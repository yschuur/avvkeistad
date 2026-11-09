# AVV Keistad — designsysteem

Dit bestand is de vaste ontwerpstandaard voor alle bestaande en toekomstige UI. Pas documentatie en implementatie samen aan. De visuele richting is geïnspireerd op de informatiedichtheid en rust van Linear, zonder de interface te kopiëren.

## Principes

Functionaliteit boven decoratie. Compacte typografie, neutrale vlakken, dunne borders en een voorspelbare navigatie. Geen hero's, illustraties, slogans, gradients, glows, decoratieve iconen of opvallende schaduwen. Gebruik iconen alleen voor navigatie, bediening of een betekenisvolle status. Gebruik semantische HTML.

## Content

Gebruik uitsluitend gegevens uit database, bestaande configuratie of een concrete gebruikersinvoer. Geen fictieve namen, datums, activiteiten, aantallen, quotes of marketingteksten. Zonder Supabase-configuratie verschijnt het inlogscherm met een configuratiemelding; nooit een demo-identiteit of voorbeeldadministratie. Testfixtures staan uitsluitend in tests/scripts en worden niet geïmporteerd door applicatiecode.

Een niet-ingesteld seizoen is onbekende informatie: toon een streepje, geen verzonnen norm of voortgang. Gebruik korte empty states zoals ‘Geen diensten ingepland.’ Een lege lijst is een geldig scherm. Aantallen en punten worden alleen uit de beschikbare gegevens berekend. Labels voor componentvoorbeelden in de huisstijlpreview zijn als zodanig herkenbaar en bevatten geen clubgegevens.

## Tokens

De centrale implementatie staat in `app/globals.css`; berekende clubkleurtokens en contrastfuncties in `lib/branding.ts`. `app/layout.tsx` past opgeslagen kleuren toe op het html-element. Hardcode geen clubkleuren in componenten.

| Rol | Token | Waarde / bron |
| --- | --- | --- |
| Canvas | `--canvas` | #fcfcfd |
| Oppervlak | `--surface` | #ffffff |
| Sidebar / subtiel vlak | `--surface-subtle` | #f7f8fa |
| Hover | `--surface-hover` | #eef0f3 |
| Border | `--border` | #e3e5e9 |
| Sterkere border | `--border-strong` | #c9cdd4 |
| Primaire tekst | `--text` | #24262d |
| Secundaire tekst | `--text-muted` | #656b76 |
| Primaire clubkleur | `--brand-primary` | Database, standaard #087d56 uit de bestaande app |
| Secundaire clubkleur | `--brand-secondary` | Database, standaard #6483b8 uit de bestaande app |
| Primaire actie | `--accent`, `--on-accent` | Clubkleur en automatisch zwart/wit met minimaal 4,5:1 contrast |
| Actieve tekst / selectie | `--accent-text`, `--accent-subtle` | Afgeleid van primaire kleur; minimaal 4,5:1 tekstcontrast |
| Ingeplande voortgang | `--secondary-text` | Secundaire kleur, zo nodig donkerder voor contrast |
| Succes | `--success`, `--success-bg` | #24613f / #eff6f1 |
| Fout / destructief | `--danger`, `--danger-bg` | #a12b35 / #fdf1f2 |
| Waarschuwing | `--warning`, `--warning-bg` | #805b1a / #faf5e9 |

De defaults zijn applicatiekleuren, geen claim over een officiële clubhuisstijl. Achtergronden en basistekst blijven neutraal. Primaire kleur is voor primaire acties, actieve navigatie en focus; secundaire kleur uitsluitend voor onderscheid tussen behaalde en ingeplande punten en de huisstijlpreview. Typebadges zijn neutraal: een diensttype is geen waarschuwing of successtatus.

Typografie: lokale systeem-sans-serif (`Inter` indien lokaal beschikbaar, daarna systeemfonts), geen externe fontrequests. Basis 13px / 1,5; paginatitel 22px / 1,3, sectietitel 14px / 1,4, tabel en labels 12px. Semibold 600, normale tekst 400. Getallen in tabellen gebruiken tabular numerals. Titels zijn taaknamen, geen welkomstteksten.

Spacing: 4, 8, 12, 16, 24, 32px; gebruik `--space-1` t/m `--space-6`. Radius: 4px voor badges, 6px voor bediening, 8px voor panelen/dialogs. Borders 1px. Geen schaduw op kaarten, tabellen of knoppen; uitsluitend een kleine schaduw op een overlay die boven inhoud ligt. Sidebar 224px; hoofdinhoud maximaal 1440px.

## Gedeelde componenten

- `Shell`: desktop-sidebar, mobiele menu-button/drawer, clubnaam, huidig seizoen en ingelogd profiel. Mobiele drawer sluit op Escape, backdrop of navigatie en houdt toetsenbordfocus binnen het menu; focus keert terug naar de trigger. Een skiplink gaat naar de hoofdinhoud.
- `Nav`: actieve pagina met `aria-current`, iconen van 16px, leesbare labels op mobiel, directe feedback tijdens navigatie. Instellingen staat bij Beheer; alleen admin/manager ziet deze toegang.
- `Heading`: één korte h1, optionele nuttige toelichting en rechts de relevante primaire actie. Geen eyebrow of standaardbeschrijving op elke pagina.
- `DutyCard`: bestaande export blijft behouden, maar rendert een compacte lijstregel met datum, dienst, type, locatie, bezetting, punten en bestaande inschrijf-/overnameacties. Mobiel stapelt dezelfde informatie.
- `SubmitButton`: spinner en disabled tijdens serveractie, bestaande actie/naam/waarde blijven intact. Standaard één primaire actie per formulier. Secundaire acties zijn neutraal; destructieve acties hebben een rood tekstaccent.
- `ConfirmSubmitButton`: gebruikt een native dialog voor bestaande destructieve acties. Annuleren en Escape muteren niets; bevestigen verstuurt het oorspronkelijke formulier inclusief submitter. Geen nieuwe businessactie.
- Tabellen: compacte rijen, subtiele header, hover, links uitgelijnde tekst en herkenbare numerieke kolommen. Geen kaart rond iedere rij. Tabelwrapper mag uitsluitend bij echte tabellen horizontaal scrollen; de pagina zelf nooit. De wrapper is focusbaar en heeft een toegankelijke naam.
- Formulieren: zichtbare labels, consistente inputhoogte 36px op desktop en minimaal 44px op touchschermen. Twee of drie kolommen alleen bij voldoende ruimte; mobiel één kolom. Checkboxlabels blijven klikbaar. Hulpuitleg alleen waar nodig voor juist invullen.
- Tabs/filters: neutrale underline-/borderselectie, bestaande GET-filters behouden. Geen zoekveld toevoegen zonder zoekfunctionaliteit. Inputwaarden en bestaande formulieracties blijven behouden.
- `Notice`: `role=alert` voor fouten, `role=status` voor resultaat. Kleur wordt altijd ondersteund door tekst. Geen automatische verdwijning van foutmeldingen.
- Empty states: één korte tekst en uitsluitend een bruikbare actie; geen illustraties.
- Loading: vaste compacte skeletonregels en status ‘Pagina laden…’. Alleen functionele spinneranimatie; `prefers-reduced-motion` schakelt animatie uit.
- Huisstijl: color picker en HEX-invoer delen één waarde, alleen `#RRGGBB` is geldig. Preview gebruikt dezelfde tokens als de applicatie. Wijzigingen zijn lokaal tot Opslaan. Standaardkleuren herstellen zet de invoer terug; daarna expliciet opslaan. De server en database controleren invoer én beheerrechten.

## Responsive en toegankelijkheid

Breakpoints: desktop >1024px; tablet 769–1024px; mobiel ≤768px. Sidebar is op mobiel een expliciet te openen menu, geen reeks onbenoemde iconen. Formulieren schakelen op 768px naar één kolom, lijsten stapelen. Op 1024px verdwijnt de derde formulierkolom. Touchbediening is minimaal 44px hoog.

Gebruik zichtbare focus (2px met 2px offset), niet uitsluitend kleur voor status, toetsenbordbediening en correcte labels. Bodytekst haalt minimaal WCAG AA 4,5:1. Berekende kleurvoorgronden zijn getest met donkere, lichte en verzadigde invoer; merkvlakken met zwart/witcontrast ondersteunen ook een witte of zwarte clubkleur. De focusring gebruikt een contrasterend afgeleid token in plaats van de onbewerkte clubkleur. Sla alleen gevalideerde HEX-waarden op, nooit willekeurige CSS.

## Do's en don'ts

Wel: ‘Diensten’, een compacte filterbalk en een lijst met echte diensten. Niet: een hero ‘Samen maken we de club’ met decoratieve illustratie.

Wel: ‘Geen leden gevonden.’ Niet: fictieve leden om een lege rapportage te vullen.

Wel: neutrale typebadge ‘Bardienst’, tekststatus ‘Ingepland’. Niet: voor elk type een willekeurige badgekleur of emoji.

Wel: één dunne border rond een samenhangend formulier. Niet: grote afgeronde kaarten voor elk invoerveld.

Wel: nieuwe UI met bestaande tokens, gedeelde componenten en bijgewerkte documentatie. Niet: een losse nieuwe stijl, fontdependency of set hardcoded clubkleuren.

## Verificatie

`npm run build` controleert productiebuild en TypeScript. `npm test` omvat de bestaande businessregels plus merkcontrast/validatie en de echte huisstijlmigratie met RLS/autorisatie. `npm run test:browser` gebruikt uitsluitend een lokale testbackend en controleert navigatie, authenticatie/herstel, formulieren, huisstijlpreview/opslag/herladen, mobiele menu-interactie en responsive overflow. Testfixtures komen niet in de productie-app. Productieopslag vereist dat migratie `002_club_branding.sql` is toegepast; zonder migratie blijft de app met standaardkleuren bruikbaar en is opslaan in Huisstijl niet beschikbaar.

## Wedstrijdwijzigingen en meldingen

Het wedstrijdprogramma gebruikt de bestaande compacte tabelstijl met datum/tijd, teams, locatie, status en gekoppelde fluitdienst. Details zijn ingeklapt en bronbeschrijvingen worden uitsluitend als tekst weergegeven, nooit als HTML. Een verstreken begintijd heet ‘Afgelopen’; ‘Gespeeld’ vereist een bevestigde bronstatus. Een verdwenen wedstrijd heet ‘Status niet bevestigd’, niet automatisch ‘Afgelast’. Onbekende datums worden niet verzonnen. Inschrijfopties verdwijnen zodra de wedstrijd gesloten is; de database controleert dit eveneens bij inschrijven.

Meldingen staan in een compacte lijst met titel, inhoud, tijdstip en een bestaande actie ‘Markeren als gelezen’. Een ongelezen aantal in de navigatie betreft uitsluitend de ingelogde gebruiker. Status wordt met tekst aangegeven. Beheerders kunnen handmatig synchroniseren. Alleen bij ingestelde mailconfiguratie verschijnt de actie om expliciet een testmelding naar hun eigen account te sturen. Ontbrekende mailconfiguratie geeft geen waarschuwing op het wedstrijdprogramma en blokkeert de import niet. De test verandert geen wedstrijdinformatie en verzint geen wedstrijdgebeurtenis. De eerste live-import en vieruurlijkse cronactivering moeten per omgeving worden gecontroleerd. Resend en de afzonderlijke mailcron zijn optioneel en kunnen later worden geactiveerd.

Het wedstrijdprogramma biedt combineerbare GET-filters voor dag, team (thuis of uit), locatie inclusief plaats en zichtbare status. Dagen worden in Nederlandse tijd bepaald, inclusief zomer-/wintertijd. Opties komen uit de volledige geïmporteerde selectie van het actieve seizoen. De tabs Programma, Historie en Alle wedstrijden behouden de filters; Filteren begint op pagina 1 en Vorige/Volgende bewaart de selectie. Filters wissen wist ook een eventuele losse wedstrijdselectie, binnen de huidige tab. Een onbekende geselecteerde team-/locatiewaarde krijgt een functionele optie zodat een leeg resultaat niet als ongefilterd wordt gepresenteerd. De vier gelabelde velden staan naast elkaar, op tablet in twee kolommen en op mobiel onder elkaar.

Het wedstrijdprogramma toont maximaal 50 echte wedstrijden per pagina, met een compacte Vorige/Volgende-navigatie. Aantallen worden berekend over de volledige selectie; de backendresultaten worden gepagineerd opgehaald zodat een API-rijlimiet het schema niet stilzwijgend afkapt. Historie staat op meest recente datum eerst.

## Seizoenenbeheer

`Beheer → Seizoenen` toont een compacte tabel van alle opgeslagen seizoenen en daarnaast één formulier voor aanmaken of bewerken. De actieve status staat als tekstbadge bij het seizoen. De geselecteerde rij heeft een neutrale achtergrond. Op maximaal 1024px staan tabel en formulier onder elkaar; datumvelden stapelen op mobiel met de gedeelde formulierregels. Datums tonen ook het jaar. Beheer bevat een korte samenvatting van het actieve seizoen en links naar dit scherm.

Nieuw en bewerken zijn afzonderlijke acties met een expliciete seizoen-ID bij bewerken. Het voorstel voor een volgend seizoen komt uitsluitend uit eerder opgeslagen datums/normen; zonder bestaand seizoen blijven velden leeg. Opslaan is expliciet, invoer blijft bij fouten behouden en veldfouten zijn gekoppeld met `aria-describedby`/`aria-invalid`; het eerste foutieve veld krijgt focus. Niet-opgeslagen wijzigingen krijgen een tekststatus. Jeugd/senioren leeg betekent algemene norm, 0 betekent vrijstelling. Een gewijzigde norm verandert het doel, niet eerder behaalde punten.

Activeren is een afzonderlijke actie met de bestaande bevestigingsdialoog en concrete uitleg over overzichten en Nevobo-import. Het eerste seizoen wordt actief wanneer er nog geen actief seizoen is; volgende seizoenen blijven inactief tot expliciete activatie. Er is geen verwijderactie en bestaande teamindelingen/diensten worden niet automatisch gekopieerd. Ontbrekende migratie 004 geeft een functionele melding zonder niet-werkend bewerkformulier.

## Nevobo-wijzigingslog

Beheerders openen **Wedstrijden → Wijzigingslog** of de historie van een afzonderlijke wedstrijd bij Wedstrijddetails. Het scherm gebruikt een compacte lijst van vastgelegde wijzigingsmomenten met de wedstrijdnaam op dat moment, tijdstip en soort wijziging. Een tabel per moment vergelijkt uitsluitend gewijzigde velden met een vorige en nieuwe waarde. Datum/tijd bevat jaar en Nederlandse tijdzone, zodat ook de dubbele kloktijd bij de wintertijdwissel te onderscheiden is. Lange namen/adressen mogen afbreken; op mobiel stapelt de tijd onder de wedstrijdtitel.

De bestaande beheerrechten gelden op het scherm en via RLS op `match_events`. Het overzicht is clubbreed over alle seizoenen, met filters voor wijzigingssoort of een wedstrijd en 25 momenten per pagina. De laatste geslaagde import toont de werkelijke aantallen nieuw/gewijzigd; een eventuele laatste fout is afzonderlijk zichtbaar. Nieuwe wedstrijden hebben een importteller maar geen oude/nieuwe wijzigingsregel. Imports zonder wijzigingen schrijven geen fictieve logregels. Een ontbrekende tabel of verbindingsfout krijgt een functionele melding.

## Scheidsrechtersniveaus

De gedeelde `RefereeLevelSelect` toont uitsluitend de codes V6, V4, R2.2, R2, R1, N3, N2 en N1 in deze oplopende volgorde, met een zichtbaar label en gekoppelde hulpuitleg. Een profiel kan ‘Niet ingesteld’ hebben; dit is een ontbrekende bevoegdheid. Nieuwe algemene fluitdiensten vereisen een expliciete code; wedstrijddiensten leiden hun minimum automatisch af uit het teamniveau. In het algemene dienstformulier is de code alleen van toepassing op fluitdiensten; bij andere diensttypen wordt deze invoer genegeerd. Beheer kan het vereiste niveau van algemene fluitdiensten in Planning beheren aanpassen. Gekoppelde wedstrijddiensten tonen daar uitsluitend het automatische minimum.

Dienstregels tonen het vereiste code-niveau en blokkeren inschrijven bij een te laag of ontbrekend niveau. De profiel- en dienstcode zijn bepalend; oude cijfers worden niet als diploma gepresenteerd of stilzwijgend aan nieuwe codes gekoppeld. Bestaande eigen inschrijvingen houden hun bestaande beheer-/overnameacties. De selector gebruikt de gedeelde formuliervelden/tokens en behoudt minimaal 44px touchhoogte op mobiel.


## Teams en competitieniveaus

**Beheer → Teams en niveaus** gebruikt de bestaande panelen en compacte correctieregels. Elke regel toont de opgeslagen teamnaam, leeftijdsgroep, clubscheidsrechter nodig of afgeleid minimum en één gelabelde competitiekeuze met Opslaan. ‘Overig / geen niveau vermeld’ staat voor een lege Excel-cel; er wordt geen competitie verzonnen. Op mobiel stapelen teamnaam en formulier via de bestaande correctieregels. Een korte uitleg benoemt het effect van een niveauwijziging op toekomstige toewijzingen; afgelopen punten blijven behouden. De clubregels tonen vanaf promotieklasse (ook de divisies) ‘Geen clubscheidsrechter nodig’, senioren eerste/tweede klasse en jeugd hoofdklasse minimaal V4, en overige klassen minimaal V6.

Wedstrijden vanaf promotieklasse tonen ‘Geen clubscheidsrechter nodig’ en bieden geen aanmaakactie. Bestaande toekomstige clubdiensten hiervoor worden geannuleerd met een melding; de wedstrijd blijft staan. Bij lagere gekoppelde wedstrijden staat het vereiste niveau als tekst ‘Vereist scheidsrechtersniveau: … of hoger (automatisch)’. Er is geen handmatig veld om dit te verlagen. Bij een onbekend of dubbelzinnig Keistad-team staat een tekstmelding en is aanmaken uitgeschakeld. Het algemene dienstformulier verwijst voor wedstrijddiensten naar Wedstrijden. Een ontbrekende migratie krijgt op Teams een functionele melding en geen opslaanknoppen. Nieuwe meldingen over ingetrokken toekomstige fluittoewijzingen gebruiken de bestaande meldingenlijst en bevatten een reden; de oorspronkelijke inschrijvingsrij blijft in de historie.
