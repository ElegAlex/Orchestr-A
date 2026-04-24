import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditPersistenceService } from './audit-persistence.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService, AuditPersistenceService],
  exports: [AuditService, AuditPersistenceService],
})
export class AuditModule {}
