import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthCookieService } from './session-cookies';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthCookieService],
  exports: [AuthService],
})
export class AuthModule {}
