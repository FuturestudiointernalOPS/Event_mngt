import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useI18n } from '@/app/providers/I18nProvider';
import { Field } from '@/components/ui/field';
import { queryKeys } from '@/lib/query-keys';
import { staffOpsApi } from '@/services/staff-ops.api';

const KINDS = [
  { kind: 'logo', label: 'branding.logo' },
  { kind: 'logo-dark', label: 'branding.logoDark' },
  { kind: 'favicon', label: 'branding.favicon' },
] as const;

/** Image uploads. The server inspects the real file type and size; the UI only picks files. */
export function BrandAssetUploads({ slug }: { slug: string }): JSX.Element {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);

  async function upload(kind: (typeof KINDS)[number]['kind'], file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      await staffOpsApi.uploadBrandAsset(slug, kind, file);
      setMessage(t('workspace.branding.saved'));
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceBranding(slug) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceContext(slug) });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('common.error'));
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {KINDS.map(({ kind, label }) => (
        <Field key={kind} label={t(label)} htmlFor={`asset-${kind}`} hint={t('branding.uploadHint')}>
          <input id={`asset-${kind}`} type="file" accept="image/png,image/jpeg,image/webp,image/x-icon" className="block w-full text-sm" onChange={(e) => void upload(kind, e.target.files?.[0])} />
        </Field>
      ))}
      {message ? <p role="status" className="text-sm sm:col-span-3">{message}</p> : null}
    </div>
  );
}
