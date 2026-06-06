import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from 'database';
import { Decimal } from '@prisma/client/runtime/library';

/** Queries taking longer than this threshold (ms) are logged as slow. */
const SLOW_QUERY_THRESHOLD_MS = 200;

// DAT-005 : @db.Decimal columns (TimeEntry.hours, Leave.days, LeaveBalance.totalDays,
// Task.estimatedHours, ProjectSnapshot.progress) come back as Prisma.Decimal whose
// default toJSON yields a string ("1.50"). The HTTP contract with the frontend ships
// these fields as JS numbers, so we override toJSON to return a number — full precision
// is preserved at the DB layer, only the serialization boundary is normalized.
//
// We attach via the runtime library import rather than the `Prisma` namespace because
// the latter is a type-only re-export under some bundler configurations (vitest+swc)
// and would resolve to undefined at module load.
(Decimal.prototype as unknown as { toJSON: () => number }).toJSON =
  function toJSON(this: Decimal): number {
    return this.toNumber();
  };

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('PrismaService');

  constructor() {
    super({ log: [{ level: 'query', emit: 'event' }] });
  }

  async onModuleInit() {
    // Register slow-query listener before connecting (OBS-023).

    (this as any).$on('query', (e: { duration: number; query: string }) => {
      if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
        this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
      }
    });
    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from database');
  }

  async cleanDatabase(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    // Defence-in-depth: only ever wipe a database whose name marks it as a
    // disposable test target. This protects the dev/prod databases even if
    // DATABASE_URL is misconfigured. Allowed: CI's `*_e2e` / `*_test` databases
    // and the integration harness's ephemeral `orchestr_a_int_*` databases.
    const [{ db }] = await this.$queryRaw<{ db: string }[]>`
      SELECT current_database() AS db
    `;
    const isTestDb =
      /(?:_e2e|_test)$/.test(db) || db.startsWith('orchestr_a_int_');
    if (!isTestDb) {
      throw new Error(
        `Refusing to clean non-test database "${db}" — its name must end ` +
          `in _e2e/_test or start with orchestr_a_int_.`,
      );
    }

    // Single atomic TRUNCATE … CASCADE over every table except the migration
    // ledger. The previous per-model deleteMany Promise.all self-deadlocked
    // (Postgres 40P01) and, on rejection, left background DELETEs racing with
    // the test run (deleting users mid-login → refresh_tokens FK violations).
    // audit_logs is append-only (BEFORE UPDATE/DELETE/TRUNCATE immutability
    // triggers) so its USER triggers are disabled for the truncate, then
    // restored. The whole thing is one synchronous round-trip — no background
    // work survives the call.
    const rows = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
    if (!tables) return;

    await this.$executeRawUnsafe(
      'ALTER TABLE "audit_logs" DISABLE TRIGGER USER',
    );
    try {
      await this.$executeRawUnsafe(
        `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`,
      );
    } finally {
      await this.$executeRawUnsafe(
        'ALTER TABLE "audit_logs" ENABLE TRIGGER USER',
      );
    }
  }
}
