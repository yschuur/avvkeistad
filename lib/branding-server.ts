import { cache } from 'react';
import { DEFAULT_BRANDING } from './branding';
import { loadBranding,publicBrandingHeaders,type BrandingState } from './branding-loader';
import { supabase } from './supabase/server';
export const getBranding=cache(async():Promise<BrandingState>=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key) return {...DEFAULT_BRANDING,available:false,identityAvailable:false,issue:'configuration'};
 const branding=await loadBranding(async select=>{
  const response=await fetch(`${url}/rest/v1/club_branding?select=${select}&id=eq.true`,{headers:publicBrandingHeaders(key),next:{revalidate:60,tags:['club-branding']},signal:AbortSignal.timeout(4000)});
  const body:unknown=await response.json();
  return response.ok?{data:body}:{data:null,error:{code:typeof body==='object'&&body!==null&&'code' in body?String(body.code):undefined,status:response.status}};
 });
 if(!branding.identityAvailable) {
  try {
   const db=await supabase(),{data:{session}}=await db.auth.getSession();
   // Session presence only selects a transport; Supabase still verifies the
   // token and RLS. Only public branding fields can enter this request cache.
   if(session) {const fresh=await getEditableBranding();if(fresh.available) return fresh;}
  } catch { /* Login screens and background jobs can keep the public fallback. */ }
 }
 return branding;
});
// Settings must not depend on a stale public response after a migration. This
// uses the verified member session and only request-scoped React memoization.
export const getEditableBranding=cache(async():Promise<BrandingState>=>{
 const db=await supabase();
 return loadBranding(async columns=>{
  const {data,error,status}=await db.from('club_branding').select(columns).eq('id',true).abortSignal(AbortSignal.timeout(5000));
  return {data,error:error?{code:error.code,status}:null};
 });
});
