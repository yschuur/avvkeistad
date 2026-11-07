import { cache } from 'react';
import { DEFAULT_BRANDING, isHexColor } from './branding';

export const getBranding = cache(async () => {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const fallback={...DEFAULT_BRANDING,available:false};
  if(!url || !key) return fallback;
  try {
    // Public colours only: this cache must never contain user or role data.
    const response=await fetch(`${url}/rest/v1/club_branding?select=primary_color,secondary_color&id=eq.true`,{
      headers:{apikey:key},next:{revalidate:60,tags:['club-branding']},signal:AbortSignal.timeout(4000),
    });
    if(!response.ok) return fallback;
    const data:unknown=await response.json();
    if(!Array.isArray(data) || data.length!==1) return fallback;
    const row=data[0] as Record<string,unknown>;
    if(typeof row.primary_color!=='string' || typeof row.secondary_color!=='string' || !isHexColor(row.primary_color) || !isHexColor(row.secondary_color)) return fallback;
    return {primaryColor:row.primary_color,secondaryColor:row.secondary_color,available:true};
  } catch { return fallback; }
});
