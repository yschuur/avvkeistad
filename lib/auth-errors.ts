type AuthFailure = { code?: string; status?: number; name?: string };

// Only public, predefined messages. Never display raw provider responses or tokens.
export function loginError(error: AuthFailure) {
  if (error.code === 'email_not_confirmed') return 'Je e-mailadres is nog niet bevestigd. Controleer je bevestigingsmail of laat de bevestiging in Supabase controleren.';
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'Er zijn te veel inlogpogingen gedaan. Wacht even en probeer het opnieuw.';
  if (error.name === 'AuthRetryableFetchError' || (error.status !== undefined && error.status >= 500)) return 'De inlogdienst is tijdelijk niet bereikbaar. Probeer het straks opnieuw.';
  if (error.status === 401 && !error.code) return 'De verbinding met Supabase is niet goed ingesteld. Laat de project-URL en publishable key controleren.';
  if (error.code === 'user_banned') return 'Aanmelden is voor dit account geblokkeerd. Neem contact op met de clubbeheerder.';
  return 'E-mailadres of wachtwoord niet herkend. Probeer opnieuw of herstel je wachtwoord.';
}
