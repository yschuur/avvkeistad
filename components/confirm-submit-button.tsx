'use client';
import { useRef, type ButtonHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';
import { SubmitButton } from './submit-button';

export function ConfirmSubmitButton({children,question,intent='destructive',title='Actie bevestigen',confirmLabel='Bevestigen',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{question:string;intent?:'primary'|'destructive';title?:string;confirmLabel?:string}) {
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null);
  const {pending}=useFormStatus();
  return <><button {...props} ref={trigger} disabled={props.disabled || pending} type="button" onClick={event=>{if(!event.currentTarget.form || event.currentTarget.form.reportValidity()) dialog.current?.showModal();}} aria-haspopup="dialog">{children}</button>
    <dialog ref={dialog} className="confirm-dialog" aria-label={title} onClose={()=>trigger.current?.focus({preventScroll:true})}><h2>{title}</h2><p>{question}</p><div className="dialog-actions"><button type="button" className="button secondary" onClick={()=>dialog.current?.close()}>Annuleren</button><SubmitButton {...props} className={intent==='destructive'?'button destructive':'button'} type="submit" onClick={event=>{
      const form=event.currentTarget.form;
      if(form && !form.reportValidity()){event.preventDefault();return;}
      dialog.current?.close();
    }}>{confirmLabel}</SubmitButton></div></dialog>
  </>;
}
