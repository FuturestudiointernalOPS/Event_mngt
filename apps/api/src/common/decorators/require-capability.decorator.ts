import { SetMetadata } from '@nestjs/common';

export const REQUIRED_CAPABILITIES_KEY = 'requiredCapabilities';

/**
 * Declares the capabilities required to call a route.
 *
 * Enforced by CapabilityGuard against the effective capability set resolved from the
 * caller's membership and organisation entitlement — never from the token or client
 * input. Platform-scoped capabilities check the platform administrator flag instead.
 *
 *   @RequireCapability(CAPABILITY_KEYS.eventsCreate)
 */
export const RequireCapability = (
  ...capabilities: string[]
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_CAPABILITIES_KEY, capabilities);
