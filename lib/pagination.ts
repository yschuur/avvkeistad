/** Collects a complete result even if the backend caps rows below our page size. */
export async function collectPages<T>(load:(from:number,to:number)=>Promise<{data:T[]|null;count?:number|null;error:unknown}>,pageSize=500,maxRows=20000):Promise<{data:T[];error:null}> {
 const rows:T[]=[];
 while(rows.length<maxRows) {
  const page=await load(rows.length,rows.length+pageSize-1);
  if(page.error || !Array.isArray(page.data)) throw new Error('De wedstrijdgegevens konden niet volledig worden opgehaald. Probeer opnieuw.');
  if(page.data.length===0) {
   if(page.count!==null && page.count!==undefined && rows.length<page.count) throw new Error('De wedstrijdgegevens zijn tijdens het ophalen gewijzigd. Probeer opnieuw.');
   return {data:rows,error:null};
  }
  rows.push(...page.data);
  if(page.count!==null && page.count!==undefined && rows.length>=page.count) return {data:rows,error:null};
  if((page.count===null || page.count===undefined) && page.data.length<pageSize) return {data:rows,error:null};
 }
 throw new Error('Het wedstrijdoverzicht is te groot om volledig op te halen. Neem contact op met de beheerder.');
}
