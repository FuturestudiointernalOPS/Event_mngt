import { Injectable } from '@nestjs/common';
import {
  Branding,
  BrandingContrastWarning,
  DEFAULT_BRANDING,
  Locale,
  UpdateBrandingRequest,
  UpdateWorkspaceSettingsRequest,
  WorkspaceContext,
} from '@event-platform/shared';
import { OrganizationStatus, WorkspaceSettings } from '../../database/prisma-client';
import { AppException } from '../../common/app-exception';
import { AUDIT_ACTIONS, type AuditAction } from '../../common/audit/audit.actions';
import { AuditService } from '../../common/audit/audit.service';
import { toBranding, toLocale } from '../../common/utils/branding';
import {
  WCAG_AA_NORMAL_TEXT,
  contrastRatio,
} from '../../common/utils/color-contrast';
import { PrismaService } from '../../database/prisma.service';
import { TenantTransactionService } from '../../database/tenant-transaction.service';
import type { TenantPrismaClient } from '../../database/tenant-transaction.service';

export interface WorkspaceSettingsView {
  organization: { id: string; slug: string; name: string };
  settings: {
    defaultLocale: Locale;
    timeZone: string;
    description: string | null;
    websiteUrl: string | null;
    contactEmail: string | null;
    retentionMonths: number | null;
  };
}

export interface BrandingView {
  branding: Branding;
  contrastWarnings: BrandingContrastWarning[];
}

/**
 * Workspace and branding. Whitespace is data: nothing here knows about a specific
 * organisation. See docs/05-branding-and-theming.md.
 */
@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantTransaction: TenantTransactionService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Public context used by the SPA to render a tenant shell and apply branding.
   *
   * Two steps, because the organisation is unknown until the slug is resolved: the
   * first query reads only the public identity that policy allows (active
   * organisations), then settings and branding are read inside the public
   * organisation scope, so they stay protected by row-level security.
   */
  async getPublicContext(slug: string): Promise<WorkspaceContext> {
    const organization = await this.prisma.organization.findFirst({
      where: { slug, status: OrganizationStatus.ACTIVE },
      select: { id: true },
    });

    if (!organization) {
      throw AppException.notFound('tenant_not_found', 'Workspace not found.');
    }

    return this.tenantTransaction.withOrganizationScope(organization.id, async (tx) => {
      const row = await tx.organization.findUnique({
        where: { id: organization.id },
        select: {
          id: true,
          slug: true,
          name: true,
          branding: true,
          settings: { select: { defaultLocale: true } },
        },
      });

      if (!row) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }

      return {
        organization: {
          id: row.id,
          slug: row.slug,
          name: row.name,
        },
        branding: row.branding ? toBranding(row.branding) : { ...DEFAULT_BRANDING },
        locale: {
          default: toLocale(row.settings?.defaultLocale),
          supported: ['fr', 'en'],
        },
      };
    });
  }

  async getSettings(): Promise<WorkspaceSettingsView> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const organization = await tx.organization.findUnique({
        where: { id: tenant.organizationId },
        select: { id: true, slug: true, name: true },
      });

      if (!organization) {
        throw AppException.notFound('tenant_not_found', 'Workspace not found.');
      }

      const settings = await tx.workspaceSettings.findUnique({
        where: { organizationId: tenant.organizationId },
      });

      return toSettingsView(organization, settings);
    });
  }

  async updateSettings(input: UpdateWorkspaceSettingsRequest): Promise<WorkspaceSettingsView> {
    const view = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      if (input.name !== undefined) {
        await tx.organization.update({
          where: { id: tenant.organizationId },
          data: { name: input.name },
        });
      }

      await tx.workspaceSettings.upsert({
        where: { organizationId: tenant.organizationId },
        create: {
          organizationId: tenant.organizationId,
          defaultLocale: input.defaultLocale ?? 'fr',
          timeZone: input.timeZone ?? 'Africa/Porto-Novo',
          description: input.description ?? null,
          websiteUrl: input.websiteUrl ?? null,
          contactEmail: input.contactEmail ?? null,
          retentionMonths: input.retentionMonths ?? null,
        },
        update: {
          ...(input.defaultLocale === undefined ? {} : { defaultLocale: input.defaultLocale }),
          ...(input.timeZone === undefined ? {} : { timeZone: input.timeZone }),
          ...(input.description === undefined ? {} : { description: input.description }),
          ...(input.websiteUrl === undefined ? {} : { websiteUrl: input.websiteUrl }),
          ...(input.contactEmail === undefined ? {} : { contactEmail: input.contactEmail }),
          ...(input.retentionMonths === undefined
            ? {}
            : { retentionMonths: input.retentionMonths }),
        },
      });

      return this.readSettingsInsideTransaction(tx, tenant.organizationId);
    });

    await this.recordChange(AUDIT_ACTIONS.settingsUpdated, view.organization.id);

    return view;
  }

  async getBranding(): Promise<BrandingView> {
    return this.tenantTransaction.withTenant(async (tx, tenant) => {
      const row = await tx.workspaceBranding.findUnique({
        where: { organizationId: tenant.organizationId },
      });

      const branding = row ? toBranding(row) : { ...DEFAULT_BRANDING };
      return { branding, contrastWarnings: checkContrast(branding) };
    });
  }

  async updateBranding(input: UpdateBrandingRequest): Promise<BrandingView> {
    const view = await this.tenantTransaction.withTenant(async (tx, tenant) => {
      const existing = await tx.workspaceBranding.findUnique({
        where: { organizationId: tenant.organizationId },
      });

      const merged: Branding = {
        ...(existing ? toBranding(existing) : DEFAULT_BRANDING),
        ...stripUndefined(input),
      };

      await tx.workspaceBranding.upsert({
        where: { organizationId: tenant.organizationId },
        create: { organizationId: tenant.organizationId, ...merged },
        update: merged,
      });

      return { branding: merged, contrastWarnings: checkContrast(merged) };
    });

    await this.recordChange(AUDIT_ACTIONS.brandingUpdated);

    return view;
  }

  private async recordChange(action: AuditAction, targetId?: string): Promise<void> {
    await this.audit.record({ action, targetType: 'workspace', targetId: targetId ?? null });
  }

  private async readSettingsInsideTransaction(
    tx: TenantPrismaClient,
    organizationId: string,
  ): Promise<WorkspaceSettingsView> {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, slug: true, name: true },
    });

    if (!organization) {
      throw AppException.notFound('tenant_not_found', 'Workspace not found.');
    }

    const settings = await tx.workspaceSettings.findUnique({
      where: { organizationId },
    });

    return toSettingsView(organization, settings);
  }
}

export function toSettingsView(
  organization: { id: string; slug: string; name: string },
  settings: WorkspaceSettings | null,
): WorkspaceSettingsView {
  return {
    organization,
    settings: {
      defaultLocale: toLocale(settings?.defaultLocale),
      timeZone: settings?.timeZone ?? 'Africa/Porto-Novo',
      description: settings?.description ?? null,
      websiteUrl: settings?.websiteUrl ?? null,
      contactEmail: settings?.contactEmail ?? null,
      retentionMonths: settings?.retentionMonths ?? null,
    },
  };
}

function stripUndefined(input: UpdateBrandingRequest): Partial<Branding> {
  const result: Partial<Branding> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Organisation-provided colours can be unreadable. We warn with the measured ratio
 * instead of silently saving a theme that fails accessibility checks.
 */
export function checkContrast(branding: Branding): BrandingContrastWarning[] {
  const pairs: Array<{ pair: string; foreground: string; background: string }> = [
    { pair: 'text-on-background', foreground: branding.textColor, background: branding.backgroundColor },
    { pair: 'text-on-surface', foreground: branding.textColor, background: branding.surfaceColor },
    { pair: 'white-on-primary', foreground: '#FFFFFF', background: branding.primaryColor },
  ];

  const warnings: BrandingContrastWarning[] = [];

  for (const { pair, foreground, background } of pairs) {
    const ratio = contrastRatio(foreground, background);
    if (ratio !== null && ratio < WCAG_AA_NORMAL_TEXT) {
      warnings.push({
        pair,
        ratio: Math.round(ratio * 100) / 100,
        required: WCAG_AA_NORMAL_TEXT,
      });
    }
  }

  return warnings;
}
