'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function SessionActivation({ url, publishableKey }: { url: string; publishableKey: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const access_token = fragment.get('access_token');
    const refresh_token = fragment.get('refresh_token');
    // Remove credentials from browser history before making any further request.
    window.history.replaceState(null, '', window.location.pathname);
    if (!access_token || !refresh_token || fragment.has('error')) { setFailed(true); return; }
    const db = createBrowserClient(url, publishableKey, { auth: { detectSessionInUrl: false } });
    // setSession validates the token with Supabase; it is not trusted as profile
    // or role data. Server rendering still verifies JWTs and RLS protects data.
    void db.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) { setFailed(true); return; }
      router.replace('/?password=1');
      router.refresh();
    }).catch(() => setFailed(true));
  }, [url, publishableKey, router]);
  return <main className="error-page">{failed ? <><h1>Deze link is ongeldig of verlopen.</h1><p>Vraag een nieuwe herstelmail aan en gebruik de meest recente link.</p><Link href="/wachtwoord-vergeten" className="button">Nieuwe herstellink aanvragen</Link></> : <><h1>Je account wordt geopend…</h1><p role="status"><span className="loading-spinner"/> Even geduld. We controleren je link.</p></>}</main>;
}
