import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthRegistrationService } from './auth-registration.service';
import { AuthService } from './auth.service';
import { AuthCookieService } from './session-cookies';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRegistrationService, AuthCookieService],
  exports: [AuthService],
})
export class AuthModule {}
