-- DAT-011 — per-recurrenceType required-field invariant (XOR), mirroring the
-- app's CreateRecurringRuleDto.validate() + occurrence-generator guards exactly
-- (so it never rejects app-valid rows; it bars raw/partial inserts):
--   WEEKLY          → dayOfWeek required
--   MONTHLY_DAY     → monthlyDayOfMonth required, dayOfWeek must be NULL
--   MONTHLY_ORDINAL → monthlyOrdinal + dayOfWeek required
ALTER TABLE "predefined_task_recurring_rules"
  ADD CONSTRAINT "ptrr_recurrence_fields_ck" CHECK (
    ("recurrenceType" = 'WEEKLY' AND "dayOfWeek" IS NOT NULL)
    OR ("recurrenceType" = 'MONTHLY_DAY'
        AND "monthlyDayOfMonth" IS NOT NULL AND "dayOfWeek" IS NULL)
    OR ("recurrenceType" = 'MONTHLY_ORDINAL'
        AND "monthlyOrdinal" IS NOT NULL AND "dayOfWeek" IS NOT NULL)
  );

-- DAT-012 — numeric ranges (match the DTO @Min/@Max): dayOfWeek 0-6,
-- monthlyOrdinal 1-5 (5=last), monthlyDayOfMonth 1-31, weekInterval >= 1.
ALTER TABLE "predefined_task_recurring_rules"
  ADD CONSTRAINT "ptrr_ranges_ck" CHECK (
    ("dayOfWeek" IS NULL OR ("dayOfWeek" BETWEEN 0 AND 6))
    AND ("monthlyOrdinal" IS NULL OR ("monthlyOrdinal" BETWEEN 1 AND 5))
    AND ("monthlyDayOfMonth" IS NULL OR ("monthlyDayOfMonth" BETWEEN 1 AND 31))
    AND ("weekInterval" >= 1)
  );
