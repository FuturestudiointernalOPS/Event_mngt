import { Module } from '@nestjs/common';
import { BadgeVerificationService } from './badge-verification.service';
import { BadgeNotifier } from './badges.notifier';
import { BadgesController } from './badges.controller';
import { BadgesRepository } from './badges.repository';
import { BadgesService } from './badges.service';

@Module({
  controllers: [BadgesController],
  providers: [
    BadgesService,
    BadgeVerificationService,
    BadgesRepository,
    BadgeNotifier,
  ],
  exports: [BadgesService, BadgeVerificationService],
})
export class BadgesModule {}
