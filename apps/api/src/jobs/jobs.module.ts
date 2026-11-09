import { Module } from '@nestjs/common';
import { DataRightsModule } from '../modules/data-rights/data-rights.module';
import { JobsService } from './jobs.service';

@Module({ imports: [DataRightsModule], providers: [JobsService] })
export class JobsModule {}
