import { NextRequest,NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/nevobo/cron-auth';
import { serviceClient,synchronizeMatches } from '@/lib/nevobo/service';
import { loadNevoboProgram } from '@/lib/nevobo/import-program';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
  if(!isCronAuthorized(request.headers.get('authorization'))) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const result=await synchronizeMatches(serviceClient(),loadNevoboProgram);
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(error) {
    const code=error instanceof Error && /^nevobo_[a-z_]+$/.test(error.message)?error.message:'nevobo_sync_failed';
    return NextResponse.json({error:code},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
export const GET=POST;
