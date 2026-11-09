import { Module } from '@nestjs/common';
import { DataRightsModule } from '../data-rights/data-rights.module';
import { IntroductionsService } from './introductions.service';
import { MeetingsService } from './meetings.service';
import { ParticipantPortalController } from './participant-portal.controller';
import { ParticipantPortalService } from './participant-portal.service';
import { ParticipantShowcaseService } from './participant-showcase.service';
import { PublicShowcaseController } from './public-showcase.controller';
import { ShowcaseService } from './showcase.service';
import { StaffOperationsController } from './staff-operations.controller';

@Module({
  imports: [DataRightsModule],
  controllers: [ParticipantPortalController, StaffOperationsController, PublicShowcaseController],
  providers: [ParticipantPortalService, ParticipantShowcaseService, MeetingsService, IntroductionsService, ShowcaseService],
})
export class ParticipantsModule {}
