import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MfaSetup } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import { AuthCard } from '@/components/layout/AuthCard';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { errorMessage } from '@/lib/errors';
import { authApi } from '@/services/auth.api';

/** Two-factor authentication: enrol with an authenticator app, keep recovery codes, turn off. */
export default function SecurityPage(): JSX.Element {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [left, setLeft] = useState(0);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (): Promise<void> => {
    const status = await authApi.mfaStatus();
    setEnabled(status.enabled);
    setLeft(status.recoveryCodesLeft);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (setup) void QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 220 }).then(setQr);
  }, [setup]);

  async function run(action: () => Promise<void>): Promise<void> {
    setError(null);
    try { await action(); } catch (e) { setError(errorMessage(e, t('common.error'))); }
  }

  return (
    <AuthCard title={t('mfa.title')}>
      {error ? <p role="alert" className="text-sm font-medium text-red-600">{error}</p> : null}
      {enabled === null ? <p role="status">{t('common.loading')}</p> : null}

      {codes ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('mfa.saveCodes')}</p>
          <ul className="grid grid-cols-2 gap-1 rounded-brand bg-brand-surface p-3 font-mono text-sm">
            {codes.map((c) => <li key={c}>{c}</li>)}
          </ul>
          <Button className="w-full" onClick={() => { setCodes(null); setSetup(null); setCode(''); void load(); }}>{t('mfa.savedThem')}</Button>
        </div>
      ) : enabled === false && !setup ? (
        <>
          <p className="text-sm">{t('mfa.intro')}</p>
          <Button className="w-full" onClick={() => void run(async () => setSetup(await authApi.mfaSetup()))}>{t('mfa.start')}</Button>
        </>
      ) : enabled === false && setup ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { setCodes((await authApi.mfaEnable(code)).recoveryCodes); }); }}>
          <p className="text-sm">{t('mfa.scan')}</p>
          {qr ? <img src={qr} alt="" className="mx-auto h-44 w-44" /> : null}
          <p className="break-all text-center font-mono text-xs">{setup.secret}</p>
          <Field label={t('mfa.code')} htmlFor="mfa-code"><Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Button type="submit" className="w-full">{t('mfa.enable')}</Button>
        </form>
      ) : enabled ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { await authApi.mfaDisable(code); setCode(''); await load(); }); }}>
          <p role="status" className="text-sm font-medium text-green-700">{t('mfa.on')} · {t('mfa.codesLeft', { count: left })}</p>
          <Field label={t('mfa.codeToDisable')} htmlFor="mfa-off"><Input id="mfa-off" required value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Button type="submit" variant="danger" className="w-full">{t('mfa.disable')}</Button>
        </form>
      ) : null}
      <Link to="/" className="block text-center text-sm text-brand-primary underline">{t('common.back')}</Link>
    </AuthCard>
  );
}
