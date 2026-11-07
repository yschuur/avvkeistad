'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="error-page"><h1>Het laden is niet gelukt.</h1><p>Controleer de Supabase-inrichting en je accountrechten. Neem contact op met de beheerder als dit blijft gebeuren.</p><button className="button" onClick={reset}>Opnieuw proberen</button></main>; }
