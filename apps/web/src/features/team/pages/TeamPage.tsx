import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { CAPABILITY_KEYS } from '@event-platform/shared';
import { useI18n } from '@/app/providers/I18nProvider';
import type { WorkspaceOutletContext } from '@/components/layout/WorkspaceShell';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { useStatusLabel } from '@/lib/status';
import { ApiRequestError } from '@/services/api-client';
import { teamApi } from '@/services/team.api';

/** Members and roles. The API enforces who may manage; the UI only hides. */
export default function TeamPage(): JSX.Element {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const statusLabel = useStatusLabel();
  const queryClient = useQueryClient();
  const { can } = useOutletContext<WorkspaceOutletContext>();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = can(CAPABILITY_KEYS.organizationManagePermissions);

  const members = useQuery({ queryKey: ['team', slug, 'members'], queryFn: () => teamApi.members(slug) });
  const roles = useQuery({ queryKey: ['team', slug, 'roles'], queryFn: () => teamApi.roles(slug) });
  const invitations = useQuery({
    queryKey: ['team', slug, 'invitations'],
    queryFn: () => teamApi.invitations(slug),
    enabled: canManage,
  });

  const refresh = (): Promise<void> => queryClient.invalidateQueries({ queryKey: ['team', slug] });
  const fail = (error: unknown): void =>
    setNotice(error instanceof ApiRequestError ? error.message : t('common.error'));

  const invite = useMutation({
    mutationFn: () => teamApi.invite(slug, { email, roleId: roleId || (roles.data?.[0]?.id ?? '') }),
    onSuccess: () => {
      setEmail('');
      setNotice(t('team.inviteSent'));
      void refresh();
    },
    onError: fail,
  });
  const update = useMutation({
    mutationFn: (input: { id: string; roleId?: string; status?: 'ACTIVE' | 'SUSPENDED' }) =>
      teamApi.updateMember(slug, input.id, { roleId: input.roleId, status: input.status }),
    onSuccess: () => void refresh(),
    onError: fail,
  });
  const remove = useMutation({
    mutationFn: (id: string) => teamApi.removeMember(slug, id),
    onSuccess: () => void refresh(),
    onError: fail,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => teamApi.revokeInvitation(slug, id),
    onSuccess: () => void refresh(),
    onError: fail,
  });

  if (members.isLoading || roles.isLoading) {
    return <LoadingState label={t('common.loading')} />;
  }
  if (members.isError || !members.data || !roles.data) {
    return <ErrorState message={t('common.error')} onRetry={() => void members.refetch()} retryLabel={t('common.retry')} />;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-brand-text">{t('team.title')}</h1>
      {notice ? <p role="status" className="rounded-brand bg-brand-surface p-3 text-sm">{notice}</p> : null}

      <section aria-labelledby="members-h" className="rounded-brand border border-brand-primary/10 bg-white">
        <h2 id="members-h" className="border-b border-brand-primary/10 p-4 text-sm font-semibold">{t('team.members')}</h2>
        <ul className="divide-y divide-brand-primary/10">
          {members.data.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.displayName ?? member.email}</p>
                <p className="truncate text-xs text-brand-text/70">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand-surface px-2 py-0.5 text-xs">{statusLabel(member.status)}</span>
                {canManage ? (
                  <>
                    <Select
                      aria-label={t('team.role')}
                      className="w-48"
                      value={member.roleId}
                      onChange={(e) => update.mutate({ id: member.id, roleId: e.target.value })}
                    >
                      {roles.data.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </Select>
                    {member.status !== 'INVITED' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: member.id, status: member.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })}
                      >
                        {member.status === 'ACTIVE' ? t('team.suspend') : t('team.activate')}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="danger" onClick={() => remove.mutate(member.id)}>
                      {t('team.remove')}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-brand-text/70">{member.roleName}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canManage ? (
        <section aria-labelledby="invite-h" className="rounded-brand border border-brand-primary/10 bg-white p-4">
          <h2 id="invite-h" className="text-sm font-semibold">{t('team.invite')}</h2>
          <form
            className="mt-3 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              invite.mutate();
            }}
          >
            <div className="min-w-56 flex-1">
              <Field label={t('auth.email')} htmlFor="invite-email">
                <Input id="invite-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
            </div>
            <div className="w-56">
              <Field label={t('team.role')} htmlFor="invite-role">
                <Select id="invite-role" value={roleId || roles.data[0]?.id || ''} onChange={(e) => setRoleId(e.target.value)}>
                  {roles.data.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" disabled={invite.isPending || roles.data.length === 0}>{t('team.send')}</Button>
          </form>

          {invitations.data && invitations.data.length > 0 ? (
            <ul className="mt-4 divide-y divide-brand-primary/10 text-sm">
              {invitations.data.map((invitation) => (
                <li key={invitation.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{invitation.email} · {invitation.roleKey}</span>
                  <Button size="sm" variant="ghost" onClick={() => revoke.mutate(invitation.id)}>
                    {t('team.revoke')}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
