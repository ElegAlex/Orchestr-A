-- OBS-012 — Deploy / release ledger
--
-- The "Deploy to Server (SSH)" workflow step was echo-only: no real deploy, and
-- nothing recorded which release was live. This table is the durable source of
-- truth for "which version was running at time T". DeploymentsService writes one
-- row per container boot in a deploy context (OnApplicationBootstrap), pinning
-- the env-injected RELEASE_SHA. audit_logs additionally gets an informational
-- RELEASE_DEPLOYED row for the Cour-des-Comptes narrative (deployments is the
-- operational source of truth; audit_logs is the cross-reference).
--
-- No FK: deployedBy is a frozen string (operator email / 'ci'), surviving user
-- deletion — same RGPD snapshot rationale as audit_logs.actorEmail. This is an
-- infra event, NOT bound by the audit_logs immutability trigger (d6299cc).
--
-- Pure additive table creation: no column changes elsewhere, no backfill,
-- no NOT NULL transition on existing data.

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "releaseSha" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deployedBy" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "nodeVersion" TEXT NOT NULL,
    "dbMigrationsApplied" JSONB,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deployments_deployedAt_idx" ON "deployments"("deployedAt");

-- CreateIndex
CREATE INDEX "deployments_environment_deployedAt_idx" ON "deployments"("environment", "deployedAt");
