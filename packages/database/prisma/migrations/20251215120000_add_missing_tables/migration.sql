-- CreateTable: LeaveTypeConfig
CREATE TABLE "leave_type_configs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#10B981',
    "icon" TEXT NOT NULL DEFAULT '🌴',
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "maxDaysPerYear" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_type_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leave_type_configs_code_key" ON "leave_type_configs"("code");

-- CreateTable: LeaveValidationDelegate
CREATE TABLE "leave_validation_delegates" (
    "id" TEXT NOT NULL,
    "delegator_id" TEXT NOT NULL,
    "delegate_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_validation_delegates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PersonalTodo
CREATE TABLE "personal_todos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_todos_userId_completed_createdAt_idx" ON "personal_todos"("userId", "completed", "createdAt");

-- CreateTable: AppSettings
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_key_key" ON "app_settings"("key");

-- AlterTable: Add columns to leaves
ALTER TABLE "leaves" ADD COLUMN "leave_type_id" TEXT;
ALTER TABLE "leaves" ADD COLUMN "validator_id" TEXT;
ALTER TABLE "leaves" ADD COLUMN "validated_by_id" TEXT;
ALTER TABLE "leaves" ADD COLUMN "validated_at" TIMESTAMP(3);
ALTER TABLE "leaves" ADD COLUMN "validation_comment" TEXT;

-- Insert default leave types
INSERT INTO "leave_type_configs" ("id", "code", "name", "description", "color", "icon", "isPaid", "requiresApproval", "isSystem", "sortOrder", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'CP', 'Congés payés', 'Congés annuels légaux', '#10B981', '🌴', true, true, true, 1, NOW()),
    (gen_random_uuid()::text, 'RTT', 'RTT', 'Réduction du temps de travail', '#3B82F6', '⏰', true, true, true, 2, NOW()),
    (gen_random_uuid()::text, 'SICK_LEAVE', 'Maladie', 'Arrêt maladie', '#EF4444', '🏥', true, false, true, 3, NOW()),
    (gen_random_uuid()::text, 'UNPAID', 'Sans solde', 'Congé sans rémunération', '#6B7280', '📋', false, true, true, 4, NOW()),
    (gen_random_uuid()::text, 'OTHER', 'Autre', 'Autre type de congé', '#8B5CF6', '📝', true, true, true, 5, NOW());

-- Update existing leaves to reference new leave_type_configs (migrate data)
UPDATE "leaves" SET "leave_type_id" = (SELECT id FROM "leave_type_configs" WHERE code = 'CP') WHERE "type" = 'CP' AND "leave_type_id" IS NULL;
UPDATE "leaves" SET "leave_type_id" = (SELECT id FROM "leave_type_configs" WHERE code = 'RTT') WHERE "type" = 'RTT' AND "leave_type_id" IS NULL;
UPDATE "leaves" SET "leave_type_id" = (SELECT id FROM "leave_type_configs" WHERE code = 'SICK_LEAVE') WHERE "type" = 'SICK_LEAVE' AND "leave_type_id" IS NULL;
UPDATE "leaves" SET "leave_type_id" = (SELECT id FROM "leave_type_configs" WHERE code = 'UNPAID') WHERE "type" = 'UNPAID' AND "leave_type_id" IS NULL;
UPDATE "leaves" SET "leave_type_id" = (SELECT id FROM "leave_type_configs" WHERE code = 'OTHER') WHERE "type" = 'OTHER' AND "leave_type_id" IS NULL;
UPDATE "leaves" SET "leave_type_id" = (SELECT id FROM "leave_type_configs" WHERE code = 'CP') WHERE "leave_type_id" IS NULL;

-- Make leave_type_id NOT NULL after migration
ALTER TABLE "leaves" ALTER COLUMN "leave_type_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "leave_validation_delegates" ADD CONSTRAINT "leave_validation_delegates_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_validation_delegates" ADD CONSTRAINT "leave_validation_delegates_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "personal_todos" ADD CONSTRAINT "personal_todos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leaves" ADD CONSTRAINT "leaves_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_type_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_validator_id_fkey" FOREIGN KEY ("validator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_validated_by_id_fkey" FOREIGN KEY ("validated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
