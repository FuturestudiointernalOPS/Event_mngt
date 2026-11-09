import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ParticipantAccess } from '../types/authenticated-user';
import type { AuthenticatedRequest } from '../types/authenticated-request';

export const PARTICIPANT_SCOPE_KEY = 'participantScoped';

/**
 * Marks a route as the participant portal: no staff session, authenticated by the
 * `x-participant-token` credential. Combine with @Public() so the staff JWT guard skips it.
 */
export const ParticipantScoped = (): MethodDecorator & ClassDecorator =>
  SetMetadata(PARTICIPANT_SCOPE_KEY, true);

export const CurrentParticipant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ParticipantAccess => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.participant) {
      throw new Error('CurrentParticipant used on a route without @ParticipantScoped()');
    }
    return request.participant;
  },
);
