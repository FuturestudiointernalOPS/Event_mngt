import { Injectable } from '@nestjs/common';
import type {
  CreateOrganizationRequest,
  OrganizationOnboardingResult,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { accountOnboardingProblem } from '../../common/utils/account-state';
import { OrganizationProvisioningService } from './organization-provisioning.service';
import { OrganizationsRepository } from './organizations.repository';

/**
 * Self-service onboarding: a signed-in account creates a workspace and becomes its
 * first administrator. No platform administrator and no technician are involved.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    private readonly repository: OrganizationsRepository,
    private readonly provisioning: OrganizationProvisioningService,
  ) {}

  async createForAccount(
    input: CreateOrganizationRequest,
    actorUserId: string,
  ): Promise<OrganizationOnboardingResult> {
    const account = await this.repository.findAccount(actorUserId);

    if (!account) {
      throw AppException.unauthorized('unauthorized', 'Sign in to continue.');
    }

    const problem = accountOnboardingProblem(account);

    if (problem === 'suspended') {
      throw AppException.forbidden(
        'account_suspended',
        'This account is suspended. Contact the platform administrator.',
      );
    }

    if (problem === 'unverified') {
      throw AppException.forbidden(
        'email_not_verified',
        'Verify your email address before creating a workspace.',
      );
    }

    return this.provisioning.provision({
      name: input.name,
      ...(input.slug ? { slug: input.slug } : {}),
      timeZone: input.timeZone,
      defaultLocale: input.defaultLocale,
      ownerUserId: actorUserId,
      actorUserId,
    });
  }
}
