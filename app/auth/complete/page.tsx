import { SessionActivation } from '@/components/session-activation';
import { configured } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default function CompleteAuth() {
  if (!configured()) redirect('/login');
  return <SessionActivation url={process.env.NEXT_PUBLIC_SUPABASE_URL!} publishableKey={process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!}/>;
}
