import { Module } from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { LeaveTypesController } from './leave-types.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LeaveTypesController],
  providers: [LeaveTypesService],
  exports: [LeaveTypesService],
})
export class LeaveTypesModule {}
