import type { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ForbiddenState } from '@/components/ui/states';
import type { WorkspaceOutletContext } from '@/components/layout/WorkspaceShell';

/**
 * Client-side capability boundary. It is a convenience, not a control: every request
 * the page makes is independently authorised by the API.
 */
export function RequireWorkspaceCapability({
  capability,
  children,
}: {
  capability: string;
  children: ReactNode;
}): JSX.Element {
  const { can } = useOutletContext<WorkspaceOutletContext>();

  if (!can(capability)) {
    return <ForbiddenState />;
  }

  return <>{children}</>;
}
