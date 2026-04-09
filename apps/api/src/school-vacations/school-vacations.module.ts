import { Module } from '@nestjs/common';
import { SchoolVacationsController } from './school-vacations.controller';
import { SchoolVacationsService } from './school-vacations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [SchoolVacationsController],
  providers: [SchoolVacationsService],
  exports: [SchoolVacationsService],
})
export class SchoolVacationsModule {}
