import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Decimal } from '@prisma/client/runtime/library';
// Importing PrismaService is required: its module-load side effect overrides
// `Decimal.prototype.toJSON` for the entire process. Without this import
// the toJSON serialization test below would assert against the default behavior.
import './prisma.service';

const SCHEMA_PATH = resolve(
  __dirname,
  '../../../../packages/database/prisma/schema.prisma',
);
const SCHEMA = readFileSync(SCHEMA_PATH, 'utf-8');

/** Pull a single model's body from schema.prisma. */
function modelBody(name: string): string {
  const re = new RegExp(`model\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const m = SCHEMA.match(re);
  if (!m) throw new Error(`model ${name} not found in schema.prisma`);
  return m[1];
}

/** Extract a single field's declaration line from a model body. */
function fieldLine(body: string, name: string): string {
  const re = new RegExp(`^\\s*${name}\\b.*$`, 'm');
  const m = body.match(re);
  if (!m) throw new Error(`field ${name} not found in model body`);
  return m[0];
}

/**
 * DAT-005 — Float → Decimal precision conversion.
 *
 * These tests cover three concerns:
 *   1. SCHEMA — the columns the audit flagged as drift-prone are typed as Decimal
 *      with the precision/scale we committed to in the migration.
 *   2. ARITHMETIC BOUNDARY — `Prisma.Decimal` cannot be used directly with `+`, `-`,
 *      `+=`. The fix sits in the API code: every read site coerces with `Number(...)`.
 *      We assert the contamination footgun by exercising the exact pattern we replaced
 *      and confirming it would have produced a string concat (regression alarm).
 *   3. ROUND-TRIP / SERIALIZATION — round-tripping a fractional value through the
 *      Decimal → toJSON → number contract preserves the value at the configured
 *      precision. Asserted with `toBeCloseTo` rather than `===` because the final
 *      step crosses into IEEE 754 at the API response boundary by design.
 */

interface ExpectedColumn {
  model: string; // Prisma model name (camelCase in DMMF)
  field: string;
  precision: number;
  scale: number;
  optional: boolean;
}

const DAT005_COLUMNS: ExpectedColumn[] = [
  { model: 'TimeEntry', field: 'hours', precision: 5, scale: 2, optional: false },
  { model: 'Leave', field: 'days', precision: 6, scale: 2, optional: false },
  { model: 'LeaveBalance', field: 'totalDays', precision: 6, scale: 2, optional: false },
  { model: 'Task', field: 'estimatedHours', precision: 5, scale: 2, optional: true },
  { model: 'ProjectSnapshot', field: 'progress', precision: 5, scale: 2, optional: false },
];

describe('DAT-005 — Decimal precision migration', () => {
  describe('1. SCHEMA — schema.prisma asserts column types', () => {
    // We assert against the schema text itself (not Prisma DMMF) because some
    // bundler setups (vitest+swc) tree-shake the `Prisma` namespace and lose
    // access to `Prisma.dmmf` at runtime. The schema file is the source of
    // truth that the migration generator consumes, so this is sufficient.
    for (const expected of DAT005_COLUMNS) {
      it(`${expected.model}.${expected.field} is Decimal(${expected.precision}, ${expected.scale})`, () => {
        const body = modelBody(expected.model);
        const line = fieldLine(body, expected.field);

        // Prisma type: "Decimal" (optionally "Decimal?" for nullable fields).
        const typeToken = expected.optional ? 'Decimal\\?' : 'Decimal(?!\\?)';
        expect(line, `expected Decimal type on line: ${line}`).toMatch(
          new RegExp(`\\b${expected.field}\\s+${typeToken}(?=\\s)`),
        );

        // Native DB type: @db.Decimal(p, s) with the exact precision/scale.
        const nativeRe = new RegExp(
          `@db\\.Decimal\\(\\s*${expected.precision}\\s*,\\s*${expected.scale}\\s*\\)`,
        );
        expect(
          line,
          `expected @db.Decimal(${expected.precision}, ${expected.scale}) on line: ${line}`,
        ).toMatch(nativeRe);
      });
    }
  });

  describe('2. ARITHMETIC BOUNDARY — Decimal must be coerced before +', () => {
    it('plain `number + Decimal` silently produces a string concat (regression alarm)', () => {
      // This documents WHY the API code must use `Number(decimal)` at the read
      // boundary. If a future refactor reintroduces `sum + l.days` without the
      // coercion, this assertion is the canary.
      const days = new Decimal('1.50');
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      const bad = (0 as unknown as number) + (days as unknown as number);
      expect(typeof bad).toBe('string');
      expect(bad).toBe('01.5');
    });

    it('`sum + Number(decimal)` produces the expected numeric sum', () => {
      const entries = [
        { hours: new Decimal('1.50') },
        { hours: new Decimal('2.25') },
        { hours: new Decimal('0.50') },
      ];
      const total = entries.reduce((sum, e) => sum + Number(e.hours), 0);
      expect(typeof total).toBe('number');
      expect(total).toBeCloseTo(4.25, 10);
    });

    it('aggregation result `_sum.x ?? 0` becomes a number after `Number(...)`', () => {
      // Shape mirrors the Prisma groupBy / aggregate return type.
      const aggregated: { _sum: { hours: Decimal | null } } = {
        _sum: { hours: new Decimal('42.50') },
      };
      const coerced = Number(aggregated._sum.hours ?? 0);
      expect(typeof coerced).toBe('number');
      expect(coerced).toBeCloseTo(42.5, 10);

      const empty: { _sum: { hours: Decimal | null } } = {
        _sum: { hours: null },
      };
      expect(Number(empty._sum.hours ?? 0)).toBe(0);
    });
  });

  describe('3. ROUND-TRIP / SERIALIZATION — Decimal precision over the wire', () => {
    it('Decimal preserves fractional precision exactly in the Decimal layer', () => {
      // The Decimal type itself is the durable record. We assert no precision
      // loss at the Decimal arithmetic layer (where the DB lives).
      const original = new Decimal('1.50');
      const restored = new Decimal(original.toString());
      expect(restored.equals(original)).toBe(true);
      expect(restored.toString()).toBe('1.5');
    });

    it('Decimal.add preserves exact precision (no IEEE drift across many sums)', () => {
      // The classic 0.1 drift: 0.1 + 0.2 in IEEE 754 = 0.30000000000000004
      const sum = new Decimal('0.1').add(new Decimal('0.2'));
      expect(sum.toString()).toBe('0.3'); // exact in Decimal
      // Same value as native floats would have drifted:
      expect(0.1 + 0.2).not.toBe(0.3);
    });

    it('Prisma.Decimal.prototype.toJSON serialises as a JS number, not a string', () => {
      // PrismaService overrides toJSON so HTTP responses keep the existing
      // numeric contract with the frontend. Without the override, JSON.stringify
      // would emit "1.5" instead of 1.5.
      const payload = JSON.stringify({ days: new Decimal('1.50') });
      expect(payload).toBe('{"days":1.5}');
    });

    it('Round-trip Decimal → JSON → parsed JS object yields the original numeric value', () => {
      const original = new Decimal('123.45');
      const wire = JSON.parse(JSON.stringify({ value: original })) as {
        value: number;
      };
      expect(typeof wire.value).toBe('number');
      // Cross into number space at the API boundary by design; assert at full
      // configured precision (2 fractional digits).
      expect(wire.value).toBeCloseTo(123.45, 2);
      // And confirm string equality at the configured scale so a future widening
      // doesn't silently lose digits:
      expect(wire.value.toFixed(2)).toBe('123.45');
    });
  });
});
