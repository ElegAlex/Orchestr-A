import { Module } from '@nestjs/common';
import { PlanningExportService } from './planning-export.service';
import { PlanningExportController } from './planning-export.controller';

@Module({
  controllers: [PlanningExportController],
  providers: [PlanningExportService],
})
export class PlanningExportModule {}
