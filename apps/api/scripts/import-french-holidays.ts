/**
 * Operational script: populate the `holidays` table by invoking the REAL
 * HolidaysService.importFrenchHolidays for one or more years.
 *
 * This is the unblock prerequisite for COR-003 (leave day calculation must
 * subtract public holidays) — the calculation fix is meaningless without
 * holiday data to consume.
 *
 * It exercises the production code path (the same method the
 * POST /holidays/import-french endpoint calls) rather than re-implementing
 * the holiday list, so dev and prod behave identically.
 *
 * Usage (run from apps/api, DATABASE_URL must point at the target DB):
 *   HOLIDAY_CREATOR_ID=<admin-user-uuid> ts-node scripts/import-french-holidays.ts 2025 2026 2027
 *
 * Safety: importFrenchHolidays only performs holiday.create; the @@unique([date])
 * constraint makes re-runs idempotent (P2002 -> skipped). No other table touched.
 */
import 'reflect-metadata';
import { PrismaClient } from 'database';
import { HolidaysService } from '../src/holidays/holidays.service';

async function main(): Promise<void> {
  const createdById = process.env.HOLIDAY_CREATOR_ID;
  if (!createdById) {
    throw new Error('HOLIDAY_CREATOR_ID env var is required (admin user uuid).');
  }

  const years = process.argv
    .slice(2)
    .map((a) => parseInt(a, 10))
    .filter((y) => Number.isInteger(y) && y > 1900 && y < 3000);
  if (years.length === 0) {
    throw new Error('Pass at least one year as an argument, e.g. 2025 2026 2027.');
  }

  const prisma = new PrismaClient();
  await prisma.$connect();
  // HolidaysService only uses prisma.holiday.*; a raw PrismaClient is structurally
  // compatible with the PrismaService it expects.
  const service = new HolidaysService(prisma as never);

  try {
    for (const year of years) {
      const res = await service.importFrenchHolidays(year, createdById);
      console.log(`[${year}] created=${res.created} skipped=${res.skipped}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
