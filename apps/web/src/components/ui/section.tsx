import type { ReactNode } from 'react';

/** A titled white panel: the repeated building block of the staff screens. */
export function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="rounded-brand border border-brand-primary/10 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-primary/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-brand-text">{title}</h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="rounded-brand border border-brand-primary/10 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-brand-text/70">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand-text">{value}</p>
    </div>
  );
}

export function Pill({ children }: { children: ReactNode }): JSX.Element {
  return <span className="rounded-full bg-brand-surface px-2.5 py-0.5 text-xs font-medium text-brand-text/80">{children}</span>;
}
