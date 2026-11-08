import { cn } from '@/lib/cn';
import { useBranding } from './ThemeProvider';

/**
 * Renders the workspace logo, or the organisation name as a text mark when no logo
 * has been uploaded. Never falls back to another tenant's asset.
 */
export function BrandLogo({ className }: { className?: string }): JSX.Element {
  const context = useBranding();
  const logoUrl = context?.branding.logoUrl;

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={context?.organization.name ?? 'Organisation logo'}
        className={cn('h-9 w-auto', className)}
      />
    );
  }

  return (
    <span className={cn('text-base font-semibold text-brand-text', className)}>
      {context?.organization.name ?? 'Event Platform'}
    </span>
  );
}
