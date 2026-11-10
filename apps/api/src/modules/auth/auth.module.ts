import { Module } from '@nestjs/common';
import { AccountMembershipsService } from './account-memberships.service';
import { AuthController } from './auth.controller';
import { AuthRegistrationService } from './auth-registration.service';
import { AuthService } from './auth.service';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { AuthCookieService } from './session-cookies';

@Module({
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    AuthRegistrationService,
    AccountMembershipsService,
    AuthCookieService,
    MfaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
