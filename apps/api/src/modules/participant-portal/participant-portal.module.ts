import { Module } from '@nestjs/common';
import { IntroductionsModule } from '../introductions/introductions.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { RegistrationsModule } from '../registrations/registrations.module';
import { ParticipantPortalController } from './participant-portal.controller';
import { ParticipantNetworkingService } from './participant-networking.service';
import { ParticipantPortalService } from './participant-portal.service';

@Module({
  imports: [RegistrationsModule, ProfilesModule, MeetingsModule, IntroductionsModule],
  controllers: [ParticipantPortalController],
  providers: [ParticipantPortalService, ParticipantNetworkingService],
})
export class ParticipantPortalModule {}
