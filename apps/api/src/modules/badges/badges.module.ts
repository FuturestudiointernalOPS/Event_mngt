import { Module } from '@nestjs/common';
import { BadgeNotifier } from './badges.notifier';
import { BadgesController } from './badges.controller';
import { BadgesRepository } from './badges.repository';
import { BadgesService } from './badges.service';

@Module({
  controllers: [BadgesController],
  providers: [BadgesService, BadgesRepository, BadgeNotifier],
  exports: [BadgesService],
})
export class BadgesModule {}
