import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REFEREE_LEVELS,canReferee,isRefereeLevel } from '../lib/referee-levels';
test('scheidsrechterscodes volgen de opgegeven volgorde en vereisen een bevestigd niveau',()=>{
 assert.deepEqual(REFEREE_LEVELS,['V6','V4','R2.2','R2','R1','N3','N2','N1']);
 for(let member=0;member<8;member++) for(let required=0;required<8;required++) assert.equal(canReferee(REFEREE_LEVELS[member],REFEREE_LEVELS[required]),member>=required);
 for(const unknown of [null,undefined,0,10,'0','R2.3','']) {assert.equal(isRefereeLevel(unknown),false);assert.equal(canReferee(unknown,'V6'),false);assert.equal(canReferee('N1',unknown),false);}
});
