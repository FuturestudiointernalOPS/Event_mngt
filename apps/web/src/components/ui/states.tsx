import type { ReactNode } from 'react';
import { Button } from './button';

export function LoadingState({ label }: { label?: string }): JSX.Element {
  return (
    <div role="status" className="flex items-center justify-center gap-3 p-8 text-sm text-brand-text/70">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-primary/30 border-t-brand-primary" />
      {label ?? 'Loading…'}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ title, message, onRetry, retryLabel }: ErrorStateProps): JSX.Element {
  return (
    <div role="alert" className="rounded-brand border border-red-200 bg-red-50 p-6">
      <p className="font-semibold text-red-800">{title ?? 'Something went wrong'}</p>
      <p className="mt-1 text-sm text-red-700">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          {retryLabel ?? 'Try again'}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-brand border border-dashed border-brand-primary/20 p-10 text-center">
      <p className="font-medium text-brand-text">{title}</p>
      {description ? <p className="mt-1 text-sm text-brand-text/70">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageFallback(): JSX.Element {
  return <LoadingState />;
}
