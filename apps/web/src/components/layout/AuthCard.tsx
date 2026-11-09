import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/branding/ThemeProvider';

/** Centered card used by the account screens, themed with the neutral platform brand. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <ThemeProvider value={null}>
      <div className="flex min-h-screen items-center justify-center bg-brand-background px-4">
        <div className="w-full max-w-sm rounded-brand border border-brand-primary/10 bg-white p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-brand-text">{title}</h1>
          <div className="mt-6 space-y-4">{children}</div>
        </div>
      </div>
    </ThemeProvider>
  );
}
