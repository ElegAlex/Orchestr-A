import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProjectsService } from '../projects/projects.service';
import { AuditPersistenceService } from '../audit/audit-persistence.service';
import { emitSystemBackfill } from './system-backfill-audit';

const SCRIPT_NAME = 'backfill-snapshots';

async function backfill() {
  const logger = new Logger('BackfillSnapshots');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const projectsService = app.get(ProjectsService);
    // OBS-018 — SYSTEM_BACKFILL audit row at START and END (the Nest context
    // gives us the hash-chained AuditPersistenceService; no raw insert).
    const auditPersistence = app.get(AuditPersistenceService);
    const args = process.argv.slice(2);
    await emitSystemBackfill(auditPersistence, 'STARTED', {
      script: SCRIPT_NAME,
      args,
    });

    logger.log('Capturing snapshots for all ACTIVE projects...');
    const start = Date.now();
    const result = await projectsService.captureSnapshots();
    logger.log(
      `Done: ${result.captured} snapshot(s) in ${Date.now() - start}ms`,
    );

    await emitSystemBackfill(auditPersistence, 'COMPLETED', {
      script: SCRIPT_NAME,
      args,
      affectedCount: result.captured,
    });
  } finally {
    await app.close();
  }
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
