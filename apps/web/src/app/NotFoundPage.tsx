import { Link } from 'react-router-dom';
import { useI18n } from '@/app/providers/I18nProvider';

export default function NotFoundPage(): JSX.Element {
  const { t } = useI18n();

  return (
    <div className="mx-auto max-w-lg p-10 text-center">
      <h1 className="text-2xl font-semibold text-brand-text">{t('notFound.title')}</h1>
      <p className="mt-2 text-sm text-brand-text/70">{t('notFound.body')}</p>
      <Link to="/login" className="mt-6 inline-block text-sm font-medium text-brand-primary underline">
        {t('auth.signIn')}
      </Link>
    </div>
  );
}
