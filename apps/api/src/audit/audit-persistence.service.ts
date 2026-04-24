import { Injectable } from '@nestjs/common';
import { Prisma } from 'database';
import { PrismaService } from '../prisma/prisma.service';

/**
 * AuditPersistenceService — persiste les événements dans la table `audit_logs`.
 *
 * Distinct de AuditService (logging console SecurityAudit) : ce service
 * écrit en base pour l'audit trail métier (transitions de statut, actions
 * système planifiées, etc.).
 *
 * W2.4 — Orchestr'A
 */
@Injectable()
export class AuditPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async log(event: {
    action: string;
    entityType: string;
    entityId: string;
    actorId?: string | null;
    payload?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        actorId: event.actorId ?? null,
        payload: (event.payload as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
