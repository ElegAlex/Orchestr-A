import { Module } from '@nestjs/common';
import { TimeTrackingService } from './time-tracking.service';
import { TimeTrackingController } from './time-tracking.controller';

@Module({
  controllers: [TimeTrackingController],
  providers: [TimeTrackingService],
  exports: [TimeTrackingService],
})
export class TimeTrackingModule {}
