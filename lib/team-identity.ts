// Sponsoring does not change team identity. Match names must identify Keistad;
// short internal names support remapping existing team memberships on import.
export function keistadTeamKey(name:string,short=false):string|null {
 const full=name.trim().match(/\bkeistad\s+(HS|DS|JA|JB|JC|MA|MB|MC|XZ|L[1-6])\s*(\d+)$/i);
 if(full) return full[1].toUpperCase()+Number(full[2]);
 if(!short) return null;
 const code=name.trim().match(/^(HS|DS|JA|JB|JC|MA|MB|MC|XZ|L[1-6])\s*(\d+)$/i);
 if(code) return code[1].toUpperCase()+Number(code[2]);
 const adult=name.trim().match(/^(Heren|Dames|H|D)\s*(\d+)$/i);
 return adult?(/^(Heren|H)$/i.test(adult[1])?'HS':'DS')+Number(adult[2]):null;
}
