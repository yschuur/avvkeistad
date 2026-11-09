import { cache } from 'react';
import { DEFAULT_BRANDING,isHexColor,validClubName,validLogoData } from './branding';
export const getBranding=cache(async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const fallback={...DEFAULT_BRANDING,available:false,identityAvailable:false};
 if(!url||!key) return fallback;
 const load=(select:string)=>fetch(`${url}/rest/v1/club_branding?select=${select}&id=eq.true`,{headers:{apikey:key},next:{revalidate:60,tags:['club-branding']},signal:AbortSignal.timeout(4000)});
 try {
  let response=await load('primary_color,secondary_color,club_name,logo_data,accent_color');
  if(!response.ok&&[400,404].includes(response.status)) response=await load('primary_color,secondary_color');
  if(!response.ok) return fallback;
  const data:unknown=await response.json();if(!Array.isArray(data)||data.length!==1) return fallback;
  const row=data[0] as Record<string,unknown>;
  if(typeof row.primary_color!=='string'||typeof row.secondary_color!=='string'||!isHexColor(row.primary_color)||!isHexColor(row.secondary_color)) return fallback;
  const extended=typeof row.club_name==='string'&&validClubName(row.club_name)&&typeof row.accent_color==='string'&&isHexColor(row.accent_color);
  return {...DEFAULT_BRANDING,primaryColor:row.primary_color,secondaryColor:row.secondary_color,accentColor:extended?row.accent_color as string:row.primary_color,clubName:extended?row.club_name as string:DEFAULT_BRANDING.clubName,logoData:extended&&typeof row.logo_data==='string'&&validLogoData(row.logo_data)?row.logo_data:null,available:true,identityAvailable:extended};
 } catch {return fallback;}
});
