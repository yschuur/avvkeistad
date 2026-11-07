'use client';

import { useFormStatus } from 'react-dom';
import type { ButtonHTMLAttributes } from 'react';

export function SubmitButton({ children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button {...props} disabled={disabled || pending} aria-busy={pending}>
    {pending && <span className="loading-spinner" aria-hidden="true"/>}
    {children}
    {pending && <span className="sr-only" role="status">Wordt verwerkt…</span>}
  </button>;
}
