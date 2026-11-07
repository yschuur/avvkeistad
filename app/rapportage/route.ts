import { NextRequest } from 'next/server';
import { getData, memberProgress } from '@/lib/data';
function cell(v: string|number) { const s=String(v); return '"'+(/^[=+\-@\t\r]/.test(s)?"'"+s:s).replaceAll('"','""')+'"'; }
export async function GET(req:NextRequest) {
 const data=await getData();
 if(data.demo || data.profile.role==='member') return new Response('Geen toegang tot deze export.',{status:403});
 const team=req.nextUrl.searchParams.get('team');const deficit=req.nextUrl.searchParams.get('deficit')==='1';
 const rows:(string|number)[][]=[['Lid','Team','Norm','Behaald','Ingepland','Nog te behalen']];
 for(const p of data.profiles) { const m=data.memberships.find(m=>m.member_id===p.id); const score=memberProgress(data,p.id); if(!m || (team && m.team_id!==team) || (deficit && score.toEarn===0)) continue; rows.push([`${p.first_name} ${p.last_name}`,data.teams.find(t=>t.id===m.team_id)?.name ?? '',score.norm,score.earned,score.planned,score.toEarn]); }
 return new Response('\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="keistad-punten.csv"','Cache-Control':'no-store'}});
}
