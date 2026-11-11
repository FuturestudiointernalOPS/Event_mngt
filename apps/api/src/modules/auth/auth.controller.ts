import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  CurrentUserResponse,
  SessionSummary,
  type AuthenticatedSession,
} from '@event-platform/shared';
import { AppException } from '../../common/app-exception';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RATE_LIMIT_BUDGETS } from '../../common/rate-limit/rate-limit.budgets';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { generateOpaqueToken } from '../../common/utils/tokens';
import { AuthService } from './auth.service';
import type { SessionMeta } from './auth.types';
import { AuthRegistrationService } from './auth-registration.service';
import {
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from './dto/auth.contracts';
import { AuthCookieService } from './session-cookies';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registration: AuthRegistrationService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Public()
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.register)
  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
  ): Promise<{ accepted: true }> {
    return this.registration.register(body);
  }

  @Public()
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.verifyEmail)
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailRequestSchema)) body: VerifyEmailRequest,
  ): Promise<{ verified: true }> {
    return this.registration.verifyEmail(body.token);
  }

  @Public()
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.login)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<unknown> {
    const result = await this.authService.login(body, sessionMeta(request));
    this.cookies.write(response, result.refreshToken, generateOpaqueToken());
    return result.session;
  }

  @Public()
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.refresh)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    this.cookies.assertCsrf(request);

    const refreshToken = this.cookies.readRefreshToken(request);
    if (!refreshToken) {
      throw AppException.unauthorized(
        'invalid_refresh_token',
        'Your session has ended. Please sign in again.',
      );
    }

    const rotated = await this.authService.refresh(refreshToken, sessionMeta(request));
    this.cookies.write(response, rotated.refreshToken, generateOpaqueToken());

    return { accessToken: rotated.accessToken, expiresIn: rotated.expiresIn };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.logout(this.cookies.readRefreshToken(request));
    this.cookies.clear(response);
  }

  @Public()
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.forgotPassword)
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema)) body: ForgotPasswordRequest,
  ): Promise<{ accepted: true }> {
    await this.registration.requestPasswordReset(body.email);
    return { accepted: true };
  }

  @Public()
  @RateLimit(...RATE_LIMIT_BUDGETS.auth.resetPassword)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema)) body: ResetPasswordRequest,
  ): Promise<void> {
    await this.registration.resetPassword(body.token, body.password);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserResponse> {
    return this.authService.me(user.id);
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthenticatedUser): Promise<SessionSummary[]> {
    return this.authService.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<void> {
    await this.authService.revokeSession(user.id, sessionId);
  }
}

function sessionMeta(request: Request): SessionMeta {
  const userAgent = request.headers['user-agent'];
  return {
    userAgent: typeof userAgent === 'string' ? userAgent : null,
    ipAddress: request.ip ?? null,
  };
}
