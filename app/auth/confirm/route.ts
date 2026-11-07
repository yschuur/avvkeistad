import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { configured, supabase } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  if (!configured()) return NextResponse.redirect(new URL('/login',request.url));
  const params = request.nextUrl.searchParams;
  const db = await supabase();
  const code = params.get('code');
  const token_hash = params.get('token_hash');
  const type = params.get('type');
  if (code) { const { error } = await db.auth.exchangeCodeForSession(code); if(!error) return NextResponse.redirect(new URL('/?password=1',request.url)); }
  if (token_hash && type && ['invite','recovery'].includes(type)) {
    const { error } = await db.auth.verifyOtp({ token_hash,type:type as EmailOtpType });
    if(!error) return NextResponse.redirect(new URL('/?password=1',request.url));
  }
  return NextResponse.redirect(new URL('/login?error=De%20uitnodigingslink%20is%20ongeldig%20of%20verlopen.',request.url));
}
