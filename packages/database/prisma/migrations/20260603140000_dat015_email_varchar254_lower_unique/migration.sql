-- DAT-015: Add VarChar(254) length cap on email (RFC 5321) and
-- functional LOWER() unique indexes on email and login for case-insensitive uniqueness.
--
-- Design: functional LOWER() indexes (no CITEXT extension needed, compatible with
-- the existing @unique Prisma declarations used by findUnique calls in auth.service.ts).
-- The @unique PSL constraint is kept; these indexes do the case-insensitive enforcement.

-- AlterTable: cap email to VarChar(254) per RFC 5321 max length
ALTER TABLE "users" ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);

-- CreateIndex: case-insensitive unique index on email (LOWER() functional index)
-- NOTE: not CONCURRENTLY — migrations run inside a transaction
CREATE UNIQUE INDEX "users_email_lower_uk" ON "users" (LOWER(email));

-- CreateIndex: case-insensitive unique index on login
CREATE UNIQUE INDEX "users_login_lower_uk" ON "users" (LOWER(login));
