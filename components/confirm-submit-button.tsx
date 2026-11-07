'use client';
import { useRef, type ButtonHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';
import { SubmitButton } from './submit-button';

export function ConfirmSubmitButton({children,question,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{question:string}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const {pending}=useFormStatus();
  return <><button {...props} disabled={props.disabled || pending} type="button" onClick={event=>{if(!event.currentTarget.form || event.currentTarget.form.reportValidity()) dialog.current?.showModal();}} aria-haspopup="dialog">{children}</button>
    <dialog ref={dialog} className="confirm-dialog" aria-label="Actie bevestigen"><h2>Actie bevestigen</h2><p>{question}</p><div className="dialog-actions"><button type="button" className="button secondary" onClick={()=>dialog.current?.close()}>Annuleren</button><SubmitButton {...props} className="button destructive" onClick={event=>{
      const form=event.currentTarget.form;
      if(form && !form.reportValidity()){event.preventDefault();return;}
      dialog.current?.close();
    }}>Bevestigen</SubmitButton></div></dialog>
  </>;
}
