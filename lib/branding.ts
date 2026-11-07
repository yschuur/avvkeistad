export const DEFAULT_BRANDING = { primaryColor: '#087D56', secondaryColor: '#6483B8' };
export type Branding = typeof DEFAULT_BRANDING;
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
export function brandingTokens(input:Branding):Record<`--${string}`,string> {
  const primary=isHexColor(input.primaryColor)?input.primaryColor.toUpperCase():DEFAULT_BRANDING.primaryColor;
  const secondary=isHexColor(input.secondaryColor)?input.secondaryColor.toUpperCase():DEFAULT_BRANDING.secondaryColor;
  const subtle=tint(primary,0.94);
  return {
    '--brand-primary':primary,'--brand-secondary':secondary,'--accent':primary,
    '--on-accent':contrast(primary,'#FFFFFF')>=contrast(primary,'#000000')?'#FFFFFF':'#000000',
    '--accent-subtle':subtle,'--accent-text':readableColor(primary,subtle),
    '--focus':readableColor(primary),'--secondary-text':readableColor(secondary),
  };
}
