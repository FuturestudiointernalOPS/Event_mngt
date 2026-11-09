import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { MembershipsController } from './memberships.controller';
import { MembershipsRepository } from './memberships.repository';
import { MembershipsService } from './memberships.service';

@Module({
  controllers: [MembershipsController, InvitationsController],
  providers: [MembershipsService, InvitationsService, MembershipsRepository],
})
export class MembershipsModule {}
