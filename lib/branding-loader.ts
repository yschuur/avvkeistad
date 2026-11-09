import { DEFAULT_BRANDING,isHexColor,validClubName,validLogoData,type Branding } from './branding';
export type BrandingIssue='configuration'|'connection'|'access'|'missing'|'invalid'|'migration';
export type BrandingState=Branding&{available:boolean;identityAvailable:boolean;issue:BrandingIssue|null};
type Result={data:unknown;error?:{code?:string;status?:number}|null};
export const BRANDING_COLUMNS='primary_color,secondary_color,club_name,logo_data,accent_color';
export async function loadBranding(query:(columns:string)=>Promise<Result>):Promise<BrandingState> {
 const fallback=(issue:BrandingIssue):BrandingState=>({...DEFAULT_BRANDING,available:false,identityAvailable:false,issue});
 try {
  let result=await query(BRANDING_COLUMNS),legacy=false;
  // A permission, token or network error is not evidence of a missing migration.
  if(result.error&&['42703','PGRST204'].includes(result.error.code??'')) {
   legacy=true;result=await query('primary_color,secondary_color');
  }
  if(result.error) return fallback(result.error.status===401||result.error.status===403||['42501','PGRST301','PGRST302'].includes(result.error.code??'')?'access':['42P01','PGRST205'].includes(result.error.code??'')?'migration':'connection');
  if(!Array.isArray(result.data)||result.data.length!==1) return fallback('missing');
  const row=result.data[0] as Record<string,unknown>;
  if(typeof row.primary_color!=='string'||typeof row.secondary_color!=='string'||!isHexColor(row.primary_color)||!isHexColor(row.secondary_color)) return fallback('invalid');
  if(!legacy&&(typeof row.club_name!=='string'||!validClubName(row.club_name)||typeof row.accent_color!=='string'||!isHexColor(row.accent_color))) return fallback('invalid');
  return {...DEFAULT_BRANDING,primaryColor:row.primary_color,secondaryColor:row.secondary_color,accentColor:legacy?row.primary_color:row.accent_color as string,clubName:legacy?DEFAULT_BRANDING.clubName:row.club_name as string,logoData:!legacy&&typeof row.logo_data==='string'&&validLogoData(row.logo_data)?row.logo_data:null,available:true,identityAvailable:!legacy,issue:legacy?'migration':null};
 } catch {return fallback('connection');}
}
export function publicBrandingHeaders(key:string):Record<string,string> {
 // Legacy anon keys are JWTs; publishable keys belong only in the apikey header.
 return {apikey:key,...(key.startsWith('eyJ')?{Authorization:`Bearer ${key}`}:{})};
}
