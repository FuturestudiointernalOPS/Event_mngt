import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import type { ParticipantAccess } from '../types/authenticated-user';

export const PARTICIPANT_SCOPE_KEY = 'participantScoped';

/**
 * Marks a route as the participant space: no staff session, authenticated by the credential
 * in the `x-participant-credential` header. Combine with @Public() so the JWT guard skips it.
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
