import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getBranding } from '@/lib/branding-server';
import { BrandingProvider } from '@/components/club-identity';
import { brandingTokens } from '@/lib/branding';
export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };
export async function generateMetadata():Promise<Metadata> {const branding=await getBranding();return {title:`${branding.clubName} · Vrijwilligers`,description:`Vrijwilligersdiensten, planning en puntenadministratie van ${branding.clubName}.`};}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const branding=await getBranding();
  return <html lang="nl" style={brandingTokens(branding)}><body><BrandingProvider value={branding}>{children}</BrandingProvider></body></html>;
}
