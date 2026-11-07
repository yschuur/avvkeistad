import { NextRequest,NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/nevobo/cron-auth';
import { deliverMatchNotifications,serviceClient } from '@/lib/nevobo/service';
export const maxDuration=60;
export const dynamic='force-dynamic';
export async function POST(request:NextRequest) {
 if(!isCronAuthorized(request.headers.get('authorization'))) return NextResponse.json({error:'Unauthorized'},{status:401});
 try {
  const result=await deliverMatchNotifications(serviceClient());
  return NextResponse.json(result,{status:result.configured?200:503});
 }catch{return NextResponse.json({error:'notification_delivery_failed'},{status:503});}
}
export const GET=POST;
