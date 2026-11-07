import type { Metadata } from 'next';
import './globals.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Keistad · Vrijwilligers', description: 'Samen maken we AVV Keistad. Plan je diensten en volg je vrijwilligerspunten.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="nl"><body>{children}</body></html>; }
