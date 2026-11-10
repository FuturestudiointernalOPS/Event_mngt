import { CAPABILITY_MODULES, type CapabilityAssignmentView } from '@event-platform/shared';

interface CapabilityToggleListProps {
  capabilities: CapabilityAssignmentView[];
  canManage: boolean;
  pendingKey: string | null;
  onToggle: (capability: CapabilityAssignmentView) => void;
}

/**
 * Capabilities grouped by module, with the three facts a manager needs visible at once:
 * whether the organisation is entitled, whether the role already grants it, and whether
 * it is effective. Direct grants are the only control here; roles are changed elsewhere.
 */
export function CapabilityToggleList({
  capabilities,
  canManage,
  pendingKey,
  onToggle,
}: CapabilityToggleListProps): JSX.Element {
  return (
    <div className="space-y-6">
      {CAPABILITY_MODULES.map((module) => {
        const items = capabilities.filter((entry) => entry.module === module.key);

        if (items.length === 0) {
          return null;
        }

        return (
          <section
            key={module.key}
            className="rounded-brand border border-brand-primary/10 bg-white"
          >
            <header className="border-b border-brand-primary/10 px-5 py-3">
              <h3 className="text-sm font-semibold text-brand-text">{module.name}</h3>
              <p className="mt-0.5 text-xs text-brand-text/60">{module.description}</p>
            </header>

            <ul className="divide-y divide-brand-primary/5">
              {items.map((capability) => (
                <li key={capability.key} className="flex items-start gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-brand-text">
                        {capability.name}
                      </span>
                      {capability.sensitive ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          Sensitive
                        </span>
                      ) : null}
                      {capability.destructive ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800">
                          Destructive
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs text-brand-text/60">{capability.description}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          capability.effective
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-brand-surface text-brand-text/60'
                        }`}
                      >
                        {capability.effective ? 'Effective' : 'Not effective'}
                      </span>

                      {capability.roleGranted ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
                          From role
                        </span>
                      ) : null}

                      {capability.directGranted ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">
                          Direct grant
                        </span>
                      ) : null}

                      {!capability.organizationEntitled ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700">
                          Not in organisation plan
                        </span>
                      ) : null}

                      {capability.missingDependencies.length > 0 ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                          Requires: {capability.missingDependencies.join(', ')}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <label className="flex shrink-0 items-center gap-2 text-xs text-brand-text/70">
                    <input
                      type="checkbox"
                      checked={capability.directGranted}
                      disabled={
                        !canManage ||
                        pendingKey === capability.key ||
                        (!capability.organizationEntitled && !capability.directGranted)
                      }
                      onChange={() => onToggle(capability)}
                      aria-label={`Grant ${capability.name} directly`}
                      className="h-4 w-4 rounded border-brand-primary/30"
                    />
                    Direct
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
