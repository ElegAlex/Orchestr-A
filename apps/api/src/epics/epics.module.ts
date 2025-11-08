import { Module } from '@nestjs/common';
import { EpicsService } from './epics.service';
import { EpicsController } from './epics.controller';

@Module({
  controllers: [EpicsController],
  providers: [EpicsService],
  exports: [EpicsService],
})
export class EpicsModule {}
