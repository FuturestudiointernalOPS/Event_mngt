import { Module } from '@nestjs/common';
import { ParticipantsController } from './participants.controller';
import { ParticipantsRepository } from './participants.repository';
import { ParticipantsService } from './participants.service';

@Module({
  controllers: [ParticipantsController],
  providers: [ParticipantsService, ParticipantsRepository],
})
export class ParticipantsModule {}
