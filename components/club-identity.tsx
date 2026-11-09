'use client';
import { createContext,useContext } from 'react';
import { DEFAULT_BRANDING,clubInitials,type Branding } from '@/lib/branding';
const BrandingContext=createContext<Branding>(DEFAULT_BRANDING);
export function BrandingProvider({value,children}:{value:Branding;children:React.ReactNode}) {return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;}
export function useBranding() {return useContext(BrandingContext);}
export function ClubMark({name,logo}:{name:string;logo:string|null}) {return logo?<img className="club-logo" src={logo} alt=""/>:<span className="brand-monogram" aria-hidden="true">{clubInitials(name)}</span>;}
export function ClubIdentity() {const b=useBranding();return <><ClubMark name={b.clubName} logo={b.logoData}/><span className="club-identity-text">{b.clubName}<small>Vrijwilligers</small></span></>;}
