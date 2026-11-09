import { Module } from '@nestjs/common';
import { InvitationsController, TeamController } from './team.controller';
import { InvitationsService } from './invitations.service';
import { TeamService } from './team.service';

@Module({
  controllers: [TeamController, InvitationsController],
  providers: [TeamService, InvitationsService],
})
export class TeamModule {}
