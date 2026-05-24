import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from 'database';
import { Decimal } from '@prisma/client/runtime/library';

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
  async onModuleInit() {
    await this.$connect();
    console.log('✅ Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('⛔ Prisma disconnected from database');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === 'string' && key[0] !== '_' && key[0] !== '$',
    ) as string[];

    return Promise.all(
      models.map((modelKey) => {
        const model = this[modelKey as keyof this];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as { deleteMany: () => Promise<unknown> }).deleteMany();
        }
        return Promise.resolve();
      }),
    );
  }
}
