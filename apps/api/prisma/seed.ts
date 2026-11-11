/**
 * Development seed: permission catalogue, system roles and a demo workspace.
 *
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD='…' npm run db:seed -w @event-platform/api
 *
 * Never commit real credentials; the admin account is only created when both
 * environment variables are provided.
 */
import {
  ALL_PERMISSIONS,
  DEFAULT_BRANDING,
  ORGANIZATION_CAPABILITY_KEYS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_TEMPLATES,
} from '@event-platform/shared';
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import {
  MemberStatus,
  OrganizationStatus,
  PrismaClient,
  UserStatus,
} from '../src/database/prisma-client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to seed the database.');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main(): Promise<void> {
  // 1. Global permission catalogue
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      create: { key },
      update: {},
    });
  }

  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  // 2. Demo organisation with branding and settings
  const organization = await prisma.organization.upsert({
    where: { slug: 'innovation-village' },
    create: {
      slug: 'innovation-village',
      name: 'Innovation Village',
      status: OrganizationStatus.ACTIVE,
      settings: {
        create: {
          defaultLocale: 'fr',
          timeZone: 'Africa/Porto-Novo',
          description: 'The Innovation Village, Cotonou.',
        },
      },
      branding: { create: { ...DEFAULT_BRANDING } },
    },
    update: {},
  });

  // 3. Organisation entitlements. Existing organisations keep every capability their
  // roles could previously exercise; platform administrators can revoke individually.
  for (const capabilityKey of ORGANIZATION_CAPABILITY_KEYS) {
    await prisma.organizationCapability.upsert({
      where: {
        organizationId_capabilityKey: { organizationId: organization.id, capabilityKey },
      },
      create: { organizationId: organization.id, capabilityKey },
      update: {},
    });
  }

  // 4. System roles for that organisation
  for (const template of SYSTEM_ROLE_TEMPLATES) {
    const role = await prisma.organizationRole.upsert({
      where: {
        organizationId_key: { organizationId: organization.id, key: template.key },
      },
      create: {
        organizationId: organization.id,
        key: template.key,
        name: template.name,
        description: template.description,
        isSystem: true,
      },
      update: { name: template.name, description: template.description },
    });

    for (const permissionKey of template.permissions) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) {
        continue;
      }
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        create: { roleId: role.id, permissionId },
        update: {},
      });
    }
  }

  // 5. Optional first administrator
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn(
      'Skipping admin account: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.',
    );
    return;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      passwordHash,
      displayName: 'Platform Administrator',
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      isPlatformAdmin: true,
    },
    update: { status: UserStatus.ACTIVE, emailVerifiedAt: new Date() },
  });

  const adminRole = await prisma.organizationRole.findUniqueOrThrow({
    where: {
      organizationId_key: {
        organizationId: organization.id,
        key: SYSTEM_ROLES.organisationAdmin,
      },
    },
  });

  await prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
    create: {
      organizationId: organization.id,
      userId: user.id,
      roleId: adminRole.id,
      status: MemberStatus.ACTIVE,
      joinedAt: new Date(),
    },
    update: { roleId: adminRole.id, status: MemberStatus.ACTIVE },
  });

  console.info(`Seeded workspace "innovation-village" with admin ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
