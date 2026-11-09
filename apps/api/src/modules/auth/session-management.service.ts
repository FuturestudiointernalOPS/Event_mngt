import { Injectable } from '@nestjs/common';
import type { SessionSummary } from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { PrismaService } from '../../database/prisma.service';
import { toSessionSummary } from './auth.mapper';

/** A signed-in user's own sessions (devices): list and revoke. */
@Injectable()
export class SessionManagementService {
  constructor(private readonly prisma: PrismaService) {}

  async listSessions(userId: string, currentSessionId: string): Promise<SessionSummary[]> {
    const sessions = await this.prisma.userSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => toSessionSummary(session, currentSessionId));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.userSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      throw AppException.notFound('not_found', 'Session not found.');
    }
  }
}
