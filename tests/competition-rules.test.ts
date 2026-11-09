import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamRefereeRequirement,clubRefereeRequired,keistadTeamKey,matchRefereeRequirement } from '../lib/competition-rules';
test('competitieregels onderscheiden senioren, jeugd, divisies en Topdivisie',()=>{
 for(const age of ['youth','senior']) for(const level of ['Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie']) assert.equal(teamRefereeRequirement(age,level),'R1');
 for(const age of ['youth','senior']) assert.equal(teamRefereeRequirement(age,'Promotieklasse'),'R2');
 for(const level of ['Eerste klasse','Tweede klasse']) {
  assert.equal(teamRefereeRequirement('senior',level),'V4');
  assert.equal(teamRefereeRequirement('youth',level),'V6');
 }
 assert.equal(teamRefereeRequirement('youth','Hoofdklasse'),'V4');
 for(const level of ['Derde klasse','Vierde klasse',null]) for(const age of ['youth','senior']) assert.equal(teamRefereeRequirement(age,level),'V6');
});
test('teamherkenning: sponsor, uit/thuis, interne wedstrijd, leeftijd en onbekende teams',()=>{
 const teams=[{name:'Proglass/AVV Keistad DS 2',age_class:'senior',competition_level:'Topdivisie'},{name:'AVV Keistad MA 2',age_class:'youth',competition_level:'Eerste klasse'}];
 assert.equal(keistadTeamKey('Nieuwe sponsor/AVV Keistad DS 02'),'DS2');
 assert.equal(keistadTeamKey('Dames 2',true),'DS2');
 assert.equal(keistadTeamKey('Heren 1',true),'HS1');
 assert.equal(keistadTeamKey('Andere club DS 2'),null);
 assert.equal(matchRefereeRequirement({home_team:'Andere club DS 2',away_team:'AVV Keistad DS 2'},teams),'R1');
 assert.equal(matchRefereeRequirement({home_team:'AVV Keistad MA 2',away_team:'Andere club MA 2'},teams),'V6');
 assert.equal(matchRefereeRequirement({home_team:'AVV Keistad MA 2',away_team:'AVV Keistad DS 2'},teams),'R1');
 assert.equal(matchRefereeRequirement({home_team:'AVV Keistad MA 2',away_team:'AVV Keistad DS 3'},teams),null);
 assert.equal(matchRefereeRequirement({home_team:'Test thuis',away_team:'Test uit'},teams),null);
 assert.equal(matchRefereeRequirement({home_team:'AVV Keistad MA 2',away_team:'Andere club'},[{...teams[1],competition_level:undefined}]),null,'Missing migration is not an unrestricted game');
 assert.equal(matchRefereeRequirement({home_team:'AVV Keistad MA 2',away_team:'Andere club'},[teams[1],teams[1]]),null,'Ambiguous teams must be resolved');
});

test('vanaf promotieklasse geen clubscheidsrechter; onbekend blijft geblokkeerd',()=>{
 for(const level of ['Superdivisie','Topdivisie','Eerste divisie','Tweede divisie','Derde divisie','Promotieklasse']) assert.equal(clubRefereeRequired(teamRefereeRequirement('senior',level)),false);
 assert.equal(clubRefereeRequired(teamRefereeRequirement('youth','Hoofdklasse')),true);
 assert.equal(clubRefereeRequired(teamRefereeRequirement('senior','Eerste klasse')),true);
 assert.equal(clubRefereeRequired(teamRefereeRequirement('youth',null)),true);
 assert.equal(clubRefereeRequired(null),null);
});
