import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';
import { AuthCard } from '@/components/layout/AuthCard';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ApiRequestError } from '@/services/api-client';
import { authApi } from '@/services/auth.api';
import { teamApi } from '@/services/team.api';
import { useSessionStore } from '@/stores/session.store';

/**
 * First step for a new account: create the organisation workspace. Afterwards the
 * administrator lands in the workspace, where branding, team and events follow.
 */
export default function OnboardingPage(): JSX.Element {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [defaultLocale, setDefaultLocale] = useState<'fr' | 'en'>(locale);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const user = useSessionStore((state) => state.user);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await teamApi.createOrganization({
        name,
        slug: slug || undefined,
        timeZone: 'Africa/Porto-Novo',
        defaultLocale,
      });
      // Refresh memberships so the new workspace is known to the session.
      const current = await authApi.me();
      useSessionStore.getState().setUser(current.user, current.memberships);
      navigate(`/workspace/${created.organization.slug}/settings/branding`, { replace: true });
    } catch (failure) {
      setError(failure instanceof ApiRequestError ? failure.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title={t('onboarding.title')}>
      <p className="text-sm text-brand-text/70">
        {t('onboarding.intro', { name: user?.displayName ?? user?.email ?? '' })}
      </p>
      <form className="space-y-4" onSubmit={(e) => void submit(e)}>
        <Field label={t('onboarding.name')} htmlFor="org-name">
          <Input id="org-name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('onboarding.slug')} htmlFor="org-slug" hint={t('onboarding.slugHint')} error={error ?? undefined}>
          <Input
            id="org-slug"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
          />
        </Field>
        <Field label={t('onboarding.language')} htmlFor="org-locale">
          <Select id="org-locale" value={defaultLocale} onChange={(e) => setDefaultLocale(e.target.value === 'en' ? 'en' : 'fr')}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </Select>
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {t('onboarding.create')}
        </Button>
      </form>
    </AuthCard>
  );
}
