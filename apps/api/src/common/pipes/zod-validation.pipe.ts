import { Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppException } from '../app-exception';

/**
 * Validates a request part against a Zod schema from `@event-platform/shared`.
 *
 *   @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest
 *
 * Unknown keys are stripped by Zod (schemas are non-passthrough), so a client cannot
 * smuggle extra fields into a service call.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw AppException.badRequest(
        'validation_error',
        'Request validation failed.',
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    return result.data;
  }
}
