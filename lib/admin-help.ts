export type AdminHelpSection = { title: string; steps?: boolean; items: readonly string[] };
/** Instructions for existing workflows; does not change permissions or rules. */
export const adminHelp = {
 overview: [
  {title:'Zo begin je',steps:true,items:['Controleer welk seizoen actief is. Dit bepaalt welke teamindelingen, diensten en punten je beheert.','Stel de teams en leden in.','Maak diensten aan en wijs teams of leden toe.']},
  {title:'Houd de administratie bij',items:['Bij Opvolgen zie je leden zonder team, vrije plaatsen en puntentekorten.','Gebruik Rapportage om de punten per lid te controleren.']},
 ],
 members: [
  {title:'Een lid instellen',steps:true,items:['Kies Instellen bij het lid.','Kies het team voor het actieve seizoen en controleer de instellingen.','Klik op Lidinstellingen opslaan.']},
  {title:'Wat betekenen de instellingen?',items:['Persoonlijke norm: leeg gebruikt de standaardnorm. Vul 0 in als het lid nul punten hoeft te behalen.','Aanvoerder: het lid kan de gereserveerde plekken van dit team invullen. De accountrol verandert niet.','Scheidsrechtersniveau: bepaalt welke fluitdiensten het lid mag aannemen.']},
  {title:'Functiepunten toevoegen',items:['Gebruik Functie toewijzen om apart punten voor een functie of functiegroep toe te kennen.']},
 ],
 teams: [
  {title:'Een team instellen',steps:true,items:['Vul de teamnaam in en kies de leeftijdsklasse.','Stel het competitieniveau in en sla het team op.','Stel via de ledenlijst de teamindeling en aanvoerder in.']},
  {title:'Twee verschillende instellingen',items:['Leeftijdsklasse: bepaalt welke seizoensnorm standaard geldt voor de leden.','Competitieniveau: bepaalt het vereiste scheidsrechtersniveau bij wedstrijdfluitdiensten.','Het persoonlijke scheidsrechtersniveau van een lid stel je bij Leden in.']},
 ],
 duties: [
  {title:'Een dienst invullen',steps:true,items:['Open Dienst beheren bij de gewenste dienst.','Reserveer plekken voor een team, of wijs zelf een geschikt lid toe.','Bij een teamreservering vult de aanvoerder de eigen plekken in. Er is pas iemand ingepland als een lid is toegewezen of ingeschreven.']},
  {title:'Zo werken de plekken',items:['Elke plek kan een eigen team krijgen. Hetzelfde team kan meerdere plekken krijgen.','Een open plek is beschikbaar voor leden die aan de inschrijfregels voldoen.','Het Teamfilter toont diensten met plekken die voor het gekozen team zijn gereserveerd.']},
  {title:'Waarom is een keuze grijs?',items:['De reden staat bij de keuze, bijvoorbeeld een overlappende dienst, eigen wedstrijd, reistijd of onvoldoende scheidsrechtersniveau.']},
 ],
 functions: [
  {title:'Functiepunten toekennen',steps:true,items:['Maak een functie aan met vaste punten voor het seizoen.','Wijs de functie toe aan een lid.','De toegekende punten tellen mee bij Behaald in dit seizoen.']},
  {title:'Let op bij aanpassen',items:['De punten van een functie wijzigen werkt door naar alle gekoppelde toekenningen in dit seizoen.','Een toekenning intrekken laat de bijbehorende punten vervallen. Het lid en diens dienstinschrijvingen blijven behouden.']},
 ],
 groups: [
  {title:'Meerdere leden dezelfde punten geven',steps:true,items:['Maak een functiegroep aan en stel de vaste punten per lid in.','Kies Beheren bij de groep.','Voeg de leden toe die deze punten moeten ontvangen.']},
  {title:'Zo worden de punten verwerkt',items:['Ieder gekoppeld lid ontvangt het volledige ingestelde puntenaantal.','Punten wijzigen bij de groep werkt door naar de gekoppelde toekenningen.','Een lid uit de groep verwijderen trekt alleen de toekenning van deze groep in.']},
 ],
 seasons: [
  {title:'Een seizoen voorbereiden',steps:true,items:['Kies Nieuw seizoen om een afzonderlijke administratie aan te maken.','Controleer de periode en puntennormen en sla het seizoen op.','Activeer het seizoen wanneer je daarmee wilt gaan werken.']},
  {title:'Wat doet Activeren?',items:['Overzichten en Nevobo-import gebruiken daarna dit seizoen.','Bestaande gegevens blijven bij hun eigen seizoen.','Controleer na het wisselen de teamindelingen en planning van het actieve seizoen.']},
 ],
 reports: [
  {title:'Wat betekenen de kolommen?',items:['Behaald: punten uit geldige afgelopen diensten en toegekende functie- en functiegroeppunten.','Ingepland: punten voor diensten die nog niet zijn afgelopen.','Nog te behalen: de norm min Behaald. Ingeplande punten zijn hier nog niet van afgetrokken.']},
  {title:'Een tekort controleren',steps:true,items:['Filter op een team of op leden onder de norm.','Bekijk ook Ingepland: een lid kan al genoeg diensten gepland hebben en toch nog een tekort tonen.','Gebruik CSV exporteren als je het overzicht buiten de tool wilt bekijken.']},
 ],
 matches: [
  {title:'Wedstrijdfluitdiensten beheren',steps:true,items:['Kies Nu synchroniseren om het actuele wedstrijdprogramma uit Nevobo op te halen.','Controleer wijzigingen via Wijzigingslog.','Maak de fluitdiensten bij de wedstrijden aan. Het vereiste scheidsrechtersniveau volgt uit het competitieniveau.','Reserveer teams of plan leden in bij de dienst.']},
  {title:'Welke gegevens kun je wijzigen?',items:['Wedstrijdvelden van gekoppelde diensten volgen Nevobo en zijn niet handmatig te wijzigen.','Teamreserveringen en lidtoewijzingen beheer je bij de dienst.']},
 ],
} satisfies Record<string, readonly AdminHelpSection[]>;
