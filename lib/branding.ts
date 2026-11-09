export type Branding={clubName:string;logoData:string|null;primaryColor:string;secondaryColor:string;accentColor:string};
export const DEFAULT_BRANDING:Branding={clubName:'AVV Keistad',logoData:null,primaryColor:'#087D56',secondaryColor:'#6483B8',accentColor:'#087D56'};
export const MAX_LOGO_BYTES=256*1024;
export function clubInitials(name:string) {return name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toLocaleUpperCase('nl');}
export function validClubName(name:string) {return name.trim().length>=2&&name.trim().length<=80&&!/[\x00-\x1f\x7f]/.test(name);}
export function validLogoData(value:string|null):boolean {
 if(value===null||value==='') return true;
 if(value.length>350000) return false;
 const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!match||match[2].length%4!==0) return false;
 try {
  const bytes=atob(match[2]);if(bytes.length>MAX_LOGO_BYTES||bytes.length<16) return false;
  const hex=(n:number)=>bytes.charCodeAt(n);
  return match[1]==='png'?bytes.slice(0,8)==='\x89PNG\r\n\x1a\n'&&bytes.slice(12,16)==='IHDR':match[1]==='jpeg'?hex(0)===255&&hex(1)===216&&hex(2)===255&&hex(bytes.length-2)===255&&hex(bytes.length-1)===217:bytes.slice(0,4)==='RIFF'&&bytes.slice(8,12)==='WEBP';
 } catch {return false;}
}
export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
export function isHexColor(value: string): boolean { return value.length===7 && HEX_COLOR.test(value); }
function rgb(hex: string) { return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)); }
function hex(channels: number[]) { return '#'+channels.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase(); }
export function luminance(color: string) {
  const c=rgb(color).map(v=>{ const n=v/255;return n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4; });
  return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;
}
export function contrast(a:string,b:string) { const l=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (l[0]+0.05)/(l[1]+0.05); }
function tint(color:string,white:number) { return hex(rgb(color).map(v=>v*(1-white)+255*white)); }
export function readableColor(color:string,background='#FFFFFF') {
  let value=color;
  for(let i=0;contrast(value,background)<4.5 && i<255;i++) value=hex(rgb(value).map(v=>Math.max(0,v-1)));
  return value;
}
export function brandingTokens(input:Pick<Branding,'primaryColor'|'secondaryColor'>&Partial<Branding>):Record<`--${string}`,string> {
  const primary=isHexColor(input.primaryColor)?input.primaryColor.toUpperCase():DEFAULT_BRANDING.primaryColor;
  const secondary=isHexColor(input.secondaryColor)?input.secondaryColor.toUpperCase():DEFAULT_BRANDING.secondaryColor;
  const accent=input.accentColor&&isHexColor(input.accentColor)?input.accentColor.toUpperCase():primary;
  const subtle=tint(primary,0.94);
  return {
    '--brand-primary':primary,'--brand-secondary':secondary,'--brand-accent':accent,'--accent':accent,
    '--on-accent':contrast(accent,'#FFFFFF')>=contrast(accent,'#000000')?'#FFFFFF':'#000000',
    '--accent-subtle':subtle,'--accent-text':readableColor(primary,subtle),
    '--progress-earned':readableColor(accent),'--focus':readableColor(accent),'--secondary-text':readableColor(secondary),
  };
}
