# Repository-instructies voor Codex

## Verplichte ontwerpstandaard

Lees `DESIGN_SYSTEM.md` voordat je UI ontwikkelt of wijzigt. Alle bestaande en nieuwe pagina's en componenten moeten dit bestand volgen. Kies niet zelfstandig een andere ontwerpstijl.

- Hergebruik de tokens in `app/globals.css` en `lib/branding.ts` en de gedeelde componenten in `components/`.
- Introduceer geen hardcoded clubkleuren, nieuwe visuele libraries, decoratieve hero's, gradients, glows, slogans of illustraties.
- Introduceer geen fictieve inhoud. Productie toont uitsluitend database-/configuratiegegevens of gebruikersinvoer. Ontbrekende gegevens krijgen een functionele empty state. Fixtures mogen uitsluitend in tests/scripts bestaan en nooit in applicatiecode worden geïmporteerd.
- Behoud businessregels, gegevens en rollen bij visuele wijzigingen. Verbreed geen rechten om een scherm te laten werken.
- Werk `DESIGN_SYSTEM.md` in dezelfde wijziging bij als tokens, componentafspraken of responsive gedrag wijzigen. Documentatie moet de daadwerkelijk geïmplementeerde standaard beschrijven.
- Controleer gewijzigde schermen op desktop én mobiel, zichtbare focus, labels, contrast en overlopende inhoud.

## Werkwijze

Gebruik de bestaande checkout; cloudtaken zijn al geïsoleerd. Maak geen worktree tenzij de gebruiker daarom vraagt. Installatie: `npm ci`; ontwikkeling: `npm run dev`. Controleer `README.md` voor Supabase- en Vercel-inrichting. Bewaar sleutels nooit in broncode of logs.

Databasewijzigingen krijgen een nieuwe, zo klein mogelijke migratie. Voer de initiële migratie niet opnieuw uit op een bestaand project. Test relevante databaseautorisaties bij nieuwe schrijfoperaties. Voer `npm test` en `npm run build` uit; gebruik de lokale browser-/integratietest bij UI-, authenticatie- of huisstijlwijzigingen. Claim productievalidatie of uitgevoerde migraties uitsluitend na daadwerkelijke verificatie.
