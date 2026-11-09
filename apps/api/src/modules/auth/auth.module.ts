import { Module } from '@nestjs/common';
import { AccountMembershipsService } from './account-memberships.service';
import { AuthController } from './auth.controller';
import { AuthRegistrationService } from './auth-registration.service';
import { AuthService } from './auth.service';
import { AuthCookieService } from './session-cookies';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRegistrationService, AccountMembershipsService, AuthCookieService],
  exports: [AuthService],
})
export class AuthModule {}
