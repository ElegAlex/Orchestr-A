import { Module } from '@nestjs/common';
import { DeploymentsService } from './deployments.service';
import { PrismaModule } from '../prisma/prisma.module';

// OBS-012 — boot-time release recorder. AuditService comes from the @Global
// AuditModule, so it needs no explicit import here (same as UsersService /
// RolesService injecting it).
@Module({
  imports: [PrismaModule],
  providers: [DeploymentsService],
  exports: [DeploymentsService],
})
export class DeploymentsModule {}
