import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginError } from '../lib/auth-errors';

test('aanmeldfouten maken onderscheid tussen credentials, bevestiging, rate limits en storing', () => {
  assert.match(loginError({code:'invalid_credentials',status:400}), /wachtwoord niet herkend/);
  assert.match(loginError({code:'email_not_confirmed',status:400}), /nog niet bevestigd/);
  assert.match(loginError({status:429}), /te veel inlogpogingen/);
  assert.match(loginError({status:503}), /tijdelijk niet bereikbaar/);
  assert.match(loginError({name:'AuthRetryableFetchError'}), /tijdelijk niet bereikbaar/);
  assert.match(loginError({status:401}), /verbinding met Supabase/);
  assert.match(loginError({code:'user_banned'}), /geblokkeerd/);
});

test('onbekende fouten onthullen geen details van de provider', () => {
  assert.equal(loginError({code:'unexpected_error',status:400}), loginError({code:'invalid_credentials',status:400}));
});
