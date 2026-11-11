import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const CONTROL_CLASSES =
  'w-full rounded-brand border border-brand-primary/20 bg-white px-3 py-2 text-sm text-brand-text ' +
  'placeholder:text-brand-text/40 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL_CLASSES, className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL_CLASSES, className)} {...props}>
        {children}
      </select>
    );
  },
);

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

/**
 * Labelled field wrapper. Errors are announced with aria-live so screen readers
 * hear validation failures instead of relying on colour alone.
 */
export function Field({ label, htmlFor, error, hint, children }: FieldProps): JSX.Element {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-brand-text">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-brand-text/70">{hint}</p> : null}
      {error ? (
        <p role="alert" aria-live="polite" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
