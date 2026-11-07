'use client';
import { useState } from 'react';
import { DEFAULT_BRANDING, brandingTokens, isHexColor, type Branding } from '@/lib/branding';
import { saveBranding } from '@/app/actions';
import { SubmitButton } from './submit-button';
export function BrandingEditor({initial,available}:{initial:Branding;available:boolean}) {
  const [draft,setDraft]=useState(initial);
  const valid=isHexColor(draft.primaryColor)&&isHexColor(draft.secondaryColor);
  const dirty=draft.primaryColor.toUpperCase()!==initial.primaryColor.toUpperCase()||draft.secondaryColor.toUpperCase()!==initial.secondaryColor.toUpperCase();
  const preview={primaryColor:isHexColor(draft.primaryColor)?draft.primaryColor:initial.primaryColor,secondaryColor:isHexColor(draft.secondaryColor)?draft.secondaryColor:initial.secondaryColor};
  return <div className="branding-layout"><section className="panel"><h2>Clubkleuren</h2><p className="muted">De kleuren gelden voor de hele applicatie, inclusief het inlogscherm. Tekstcontrast wordt automatisch aangepast.</p>
    <form action={saveBranding} className="stack-form">{(['primaryColor','secondaryColor'] as const).map((field,index)=>{
      const label=index===0?'Primaire kleur':'Secundaire kleur';
      return <div className="color-field" key={field}><label htmlFor={field}>{label}</label><div className="color-inputs"><input type="color" aria-label={`${label} kiezen`} value={isHexColor(draft[field])?draft[field]:initial[field]} onChange={e=>setDraft({...draft,[field]:e.target.value.toUpperCase()})}/><input id={field} name={field} value={draft[field]} onChange={e=>setDraft({...draft,[field]:e.target.value})} pattern="#[0-9a-fA-F]{6}" maxLength={7} required spellCheck={false} autoComplete="off" aria-describedby={`${field}-help`}/></div><small id={`${field}-help`} className="field-help">{isHexColor(draft[field])?(index===0?'Acties, selectie en actieve navigatie.':'Ingeplande punten in de voortgangsbalk.'):'Gebruik # gevolgd door zes HEX-tekens.'}</small></div>;
    })}<div className="form-actions"><SubmitButton className="button" disabled={!available || !valid || !dirty}>Kleuren opslaan</SubmitButton><button type="button" className="button secondary" onClick={()=>setDraft({...DEFAULT_BRANDING})}>Standaardkleuren herstellen</button></div><p className="field-help" role="status">{dirty?'Niet-opgeslagen wijzigingen.':'Geen niet-opgeslagen wijzigingen.'}</p></form>
  </section><section className="panel branding-preview" style={brandingTokens(preview)} aria-labelledby="preview-heading"><h2 id="preview-heading">Preview</h2><p className="muted">Voorbeeld van de bestaande componenten met deze kleuren.</p><div className="preview-components"><span className="preview-nav">Diensten</span><div className="preview-actions"><span className="button">Primaire actie</span><span className="button secondary">Secundaire actie</span></div><div className="preview-status"><span className="badge">Bardienst</span><span className="preview-secondary">Ingeplande punten</span></div><span className="field-help">Opslaan past de kleuren toe. Standaardkleuren herstellen moet ook worden opgeslagen.</span></div></section></div>;
}
