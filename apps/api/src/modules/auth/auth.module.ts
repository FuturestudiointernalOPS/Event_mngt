import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRegistrationService } from './auth-registration.service';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { SessionManagementService } from './session-management.service';
import { AuthService } from './auth.service';
import { AuthCookieService } from './session-cookies';

@Module({
  controllers: [AuthController, MfaController],
  providers: [AuthService, AuthRegistrationService, AuthCookieService, MfaService, SessionManagementService],
  exports: [AuthService],
})
export class AuthModule {}
