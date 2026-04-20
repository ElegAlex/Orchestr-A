import { Module } from '@nestjs/common';
import { TeleworkService } from './telework.service';
import { TeleworkController } from './telework.controller';

@Module({
  controllers: [TeleworkController],
  providers: [TeleworkService],
  exports: [TeleworkService],
})
export class TeleworkModule {}
