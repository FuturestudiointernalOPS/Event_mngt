/**
 * Request contracts for the auth surface. Re-exported from the shared package so the
 * web app validates with exactly the same schema.
 */
export {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from '@event-platform/shared';

export type {
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@event-platform/shared';
