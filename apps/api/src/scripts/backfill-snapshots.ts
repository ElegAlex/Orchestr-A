import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ProjectsService } from '../projects/projects.service';

async function backfill() {
  const logger = new Logger('BackfillSnapshots');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const projectsService = app.get(ProjectsService);
    logger.log('Capturing snapshots for all ACTIVE projects...');
    const start = Date.now();
    const result = await projectsService.captureSnapshots();
    logger.log(`Done: ${result.captured} snapshot(s) in ${Date.now() - start}ms`);
  } finally {
    await app.close();
  }
}

backfill().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Backfill failed:', err);
  process.exit(1);
});
