import type { Metadata } from 'next';
import './globals.css';
import { getBranding } from '@/lib/branding-server';
import { brandingTokens } from '@/lib/branding';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'AVV Keistad · Vrijwilligers', description: 'Vrijwilligersdiensten, planning en puntenadministratie van AVV Keistad.' };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const branding=await getBranding();
  return <html lang="nl" style={brandingTokens(branding)}><body>{children}</body></html>;
}
