# Security Audit Remediation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task via Opus subagents dispatched in waves. Each wave is a parallel `Agent` fan-out; review checkpoints between waves. Commit on master (no feature branches, per user memory). Push + VPS deploy after each wave.

**Goal:** Remediate the 8 security findings (SEC-01 → SEC-08) and 8 functional bugs (BUG-01 → BUG-08) from the 2026-04-15 audit by HAMMACHE Lilian, without regressing existing features.

**Architecture:**
- **Backend-first trust:** every authorization decision moves server-side. Frontend role in localStorage becomes display-only derived from `/auth/me`.
- **Transverse ownership layer:** a shared `OwnershipGuard` + `@OwnershipCheck()` decorator, applied module-by-module, resolves SEC-06 and its functional manifestations (BUG-01/04/05/08) with a single pattern.
- **Session hardening:** refresh-token flow backed by a Redis blacklist reuses existing Redis infra (already used by `role-management.service` permission cache).
- **Incremental, testable waves:** 5 waves dispatched as parallel Opus subagents; each wave ends with `pnpm run build` + targeted E2E + commit + push + deploy.

**Tech Stack:** NestJS 11 + Fastify 5, Prisma 6, Redis 7.4, Next.js 16, Zustand, Playwright, Vitest.

**Audit source:** `docs/security/2026_04_15_Rapport_audit.md`.

**Key audit refinements discovered during mapping (2026-04-15):**
- SEC-03 is about **role** in localStorage, not JWT (JWT in localStorage is a conscious choice per CLAUDE.md).
- `leaves` and `telework` already have ownership checks — audit findings cover edge-case paths; verification pass rather than rewrite.
- `documents.service.ts` only persists metadata (no upload logic); SEC-07 mainly affects `users.service.ts:1288-1292` (avatar) and any future multipart route.
- Swagger is already env-gated (`SWAGGER_ENABLED`); SEC-01 reduces to a prod env hygiene check + doc.

---

## File Structure — Files Created / Modified

### Backend (apps/api/src)

- **Create:**
  - `common/guards/ownership.guard.ts` — shared ownership enforcement
  - `common/decorators/ownership-check.decorator.ts` — `@OwnershipCheck({ resource, paramKey, field })`
  - `common/services/ownership.service.ts` — centralized resource → owner resolution (Prisma-backed)
  - `auth/refresh-token.service.ts` — refresh/rotate/revoke logic
  - `auth/jwt-blacklist.service.ts` — Redis blacklist for access tokens (JTI-keyed)
  - `auth/dto/refresh-token.dto.ts`
  - `common/fastify/redact.config.ts` — centralized pino redact paths
  - `common/upload/magic-bytes.validator.ts` — reusable `file-type` wrapper with MIME whitelist
- **Modify:**
  - `main.ts` — Fastify logger with redact; Swagger prod guard comment
  - `app.module.ts` — tighten throttler defaults
  - `auth/auth.module.ts` — register refresh/blacklist services, shorten access-token TTL
  - `auth/auth.controller.ts` — tighten login throttle to 5/min, add `POST /auth/refresh`, `POST /auth/logout` (real revoke)
  - `auth/auth.service.ts` — issue refresh tokens, store refresh hash, verify blacklist on validate
  - `auth/strategies/jwt.strategy.ts` — check blacklist
  - `leaves/leaves.controller.ts` — `@OwnershipCheck` on findOne/update/remove paths
  - `telework/telework.controller.ts` — same
  - `time-tracking/time-tracking.controller.ts` — same + audit update/delete paths (service-level checks)
  - `projects/projects.service.ts` — ownership/membership enforcement in `update`, `remove`, `updateMember`, `removeMember`
  - `events/events.service.ts` — creator/participant checks in `update`, `remove`, `addParticipant`, `removeParticipant`
  - `users/users.service.ts:1288-1292` — keep magic-bytes; add to any other upload path
  - `documents/documents.service.ts` — if/when upload added, use `MagicBytesValidator`

### Database (packages/database/prisma)

- **Modify:**
  - `schema.prisma` — add `RefreshToken` model (userId, tokenHash, expiresAt, revokedAt, userAgent, ip); add `forcePasswordChange Boolean @default(false)` on `User`
  - `seed.ts` — env-gate the `admin/admin123` upsert, generate strong random password when `SEED_ADMIN_PASSWORD` unset, log to stdout once
- **Create migration:** `pnpm --filter @orchestra/database exec prisma migrate dev --name security-audit-remediation`

### Frontend (apps/web)

- **Modify:**
  - `src/services/auth.service.ts` — stop persisting `user.role` in localStorage; keep `access_token`; store only non-sensitive `{id, email, firstName, lastName}` display cache
  - `src/stores/auth.store.ts` — hydrate role from `/auth/me` on app bootstrap via a `useAuthBootstrap` hook; treat role as ephemeral (state only, never persisted)
  - `src/lib/api.ts` — add 401-refresh interceptor (try `/auth/refresh` once, queue concurrent calls)
  - `src/hooks/useAuthBootstrap.ts` — NEW: on mount, call `/auth/me` + `/auth/me/permissions`, populate store
  - `app/[locale]/profile/page.tsx:309-323` — BUG-06 fix (parse `createdAt` with null-safe date formatter)
  - `app/[locale]/users/page.tsx:632-639`, `users/[id]/suivi/page.tsx:668-673` — BUG-07 active/inactive derivation fix
  - `src/components/tasks/TaskForm.tsx` — BUG-02 resolve assignees before first paint (useQuery with `suspense` or skeleton until resolved)
  - `src/components/planning/PlanningView.tsx` (and `usePlanningData.ts`) — BUG-03 default-select all services on first mount when store is empty

### E2E (e2e/tests)

- **Create:**
  - `e2e/tests/security/ownership-idor.spec.ts` — cross-user 403 for leaves, telework, time-tracking, projects, events
  - `e2e/tests/security/auth-hardening.spec.ts` — role-tampering rejection, refresh flow, logout revocation, login throttle
  - `e2e/tests/security/upload-validation.spec.ts` — magic-bytes rejection

### Infra / ops

- **Modify:**
  - `.env.example` — document `SEED_ADMIN_PASSWORD`, `SWAGGER_ENABLED`, `JWT_ACCESS_TTL=15m`, `JWT_REFRESH_TTL=7d`, `LOG_LEVEL=info` for prod
  - `docker-compose.prod.yml` — confirm `SWAGGER_ENABLED` unset, `LOG_LEVEL=info`
  - `docs/security/REMEDIATION_STATUS.md` — living doc: finding → commit → status

---

## Execution Model — Waves & Subagent Dispatch

Each wave below is dispatched as a **single message with multiple `Agent` tool calls** (parallel Opus subagents). Between waves: main session runs `pnpm run build` + targeted tests, reviews diffs, commits bundled work if subagents didn't commit, pushes, deploys to VPS, then proceeds.

**Common instructions for every subagent:**
- Model: **Opus 4.6** (user memory: never Sonnet/Haiku for agents)
- Work on **master** directly (user memory: no feature branches)
- After making changes: `pnpm run build` must pass. If frontend changed, at least typecheck + relevant Jest tests. If backend changed, run the module's Vitest spec.
- Commit with the convention `<type>(<scope>): <msg>` co-authored (Claude Opus 4.6 1M).
- Report: files touched, tests run, build status, commit SHA.
- **Do NOT push** — the main session batches push + deploy per wave.

---

## WAVE 1 — Hotfix Quick Wins (6 parallel subagents)

Independent, small-blast-radius fixes. All can run in parallel.

### Task 1.1 — SEC-02: Env-gate default admin seed

**Files:**
- Modify: `packages/database/prisma/seed.ts:1470-1481`
- Modify: `.env.example`

**Subagent prompt (Opus, parallel):**

> Fix SEC-02 from the audit at `docs/security/2026_04_15_Rapport_audit.md`. Currently `packages/database/prisma/seed.ts:1470-1481` unconditionally upserts `admin/admin123`. Change to:
> 1. Read `SEED_ADMIN_PASSWORD` env var.
> 2. If unset AND `NODE_ENV === 'production'`: skip admin seed entirely, log a warning.
> 3. If unset AND non-prod: generate a 24-char random password via `crypto.randomBytes`, bcrypt-hash, log the plaintext to stdout **once** with a prominent banner.
> 4. If set: use that password.
> 5. Add `forcePasswordChange: true` on the user record when password came from the random generator (add the field to `User` in `schema.prisma` with `@default(false)` and create a migration named `add-force-password-change`).
> 6. Update `.env.example` with `SEED_ADMIN_PASSWORD=` (commented, with guidance).
> 7. Verify: `pnpm run build` passes; `pnpm --filter @orchestra/database exec tsx prisma/seed.ts` runs locally without crashing (dev DB).
> Commit: `fix(security): SEC-02 env-gate default admin seed and force password change`.

**Acceptance:** Seed without `SEED_ADMIN_PASSWORD` in `NODE_ENV=production` leaves admin untouched. Non-prod logs a strong random password.

---

### Task 1.2 — SEC-01: Swagger prod hygiene

**Files:**
- Modify: `apps/api/src/main.ts:67-89`
- Modify: `docker-compose.prod.yml` (verify `SWAGGER_ENABLED` absent)
- Modify: `.env.example`

**Subagent prompt:**

> Fix SEC-01. Swagger is already gated by `process.env.SWAGGER_ENABLED === 'true'` at `apps/api/src/main.ts:67-89`. Harden:
> 1. Add an **additional** guard: if `NODE_ENV === 'production'` AND `SWAGGER_ENABLED === 'true'`, log a `[SECURITY WARNING]` banner on startup but still mount (ops may want this temporarily).
> 2. Ensure `docker-compose.prod.yml` has NO `SWAGGER_ENABLED` env entry (remove if present).
> 3. Document in `.env.example`: `SWAGGER_ENABLED=false  # NEVER set to true in production`.
> 4. Add a basic auth guard option: if `SWAGGER_USER`/`SWAGGER_PASS` are set, protect `api/docs` via Fastify basic auth middleware.
> Commit: `fix(security): SEC-01 harden Swagger prod exposure with basic-auth option`.

**Acceptance:** `docker compose -f docker-compose.prod.yml config` shows no `SWAGGER_ENABLED`. Local `SWAGGER_ENABLED=true SWAGGER_USER=a SWAGGER_PASS=b pnpm --filter @orchestra/api dev` requires basic auth at `/api/docs`.

---

### Task 1.3 — SEC-08: Fastify logger redact

**Files:**
- Create: `apps/api/src/common/fastify/redact.config.ts`
- Modify: `apps/api/src/main.ts:17`

**Subagent prompt:**

> Fix SEC-08. Currently `new FastifyAdapter({ logger: true })` at `apps/api/src/main.ts:17` has no redact config.
> 1. Create `apps/api/src/common/fastify/redact.config.ts` exporting `fastifyLoggerOptions` with:
>    ```ts
>    export const fastifyLoggerOptions = {
>      level: process.env.LOG_LEVEL ?? 'info',
>      redact: {
>        paths: [
>          'req.headers.authorization',
>          'req.headers.cookie',
>          'req.body.password',
>          'req.body.currentPassword',
>          'req.body.newPassword',
>          'req.body.refreshToken',
>          'res.headers["set-cookie"]',
>        ],
>        censor: '[REDACTED]',
>      },
>    };
>    ```
> 2. Wire it: `new FastifyAdapter({ logger: fastifyLoggerOptions })`.
> 3. Verify locally with `LOG_LEVEL=debug pnpm --filter @orchestra/api dev`: hitting `/auth/login` must show `password: "[REDACTED]"` in logs.
> Commit: `fix(security): SEC-08 redact sensitive fields in Fastify logger`.

**Acceptance:** Login body logs show `[REDACTED]` for password in debug mode.

---

### Task 1.4 — SEC-05: Tighten login throttling

**Files:**
- Modify: `apps/api/src/auth/auth.controller.ts:33-36`
- Modify: `apps/api/src/app.module.ts:41-52`

**Subagent prompt:**

> Fix SEC-05. Currently login is 20/min + 100/15min at `auth.controller.ts:33-36`.
> 1. Replace login `@Throttle` decorator with `{ short: { limit: 5, ttl: 60_000 }, medium: { limit: 20, ttl: 900_000 } }`.
> 2. Apply same tight limits to `/auth/register` and `/auth/reset-password`.
> 3. Keep global throttler untouched (non-auth endpoints).
> 4. Add Vitest: `apps/api/src/auth/auth.controller.spec.ts` — smoke test the decorator is present (reflect-metadata read on the handler). If this is impractical, add an E2E in wave 5.
> 5. `pnpm run build` must pass.
> Commit: `fix(security): SEC-05 tighten /auth/login throttling to 5/min`.

**Acceptance:** Decorator values updated; reflection metadata shows new limits.

---

### Task 1.5 — BUG-06: Profile "Membre depuis" invalid date

**Files:**
- Modify: `apps/web/app/[locale]/profile/page.tsx:309-323`

**Subagent prompt:**

> Fix BUG-06. Profile page renders "Invalid date" for `user.createdAt`.
> 1. Read the current render block at `apps/web/app/[locale]/profile/page.tsx:309-323`.
> 2. Root-cause: likely `new Date(user.createdAt)` called when `user` is null on first render, or `createdAt` arrives as ISO string that `date-fns/format` fails on due to locale mismatch.
> 3. Fix: use a guarded formatter — if `!user?.createdAt` render `—`; else `format(parseISO(user.createdAt), 'PPP', { locale: fr })`.
> 4. Check for the same bug on `apps/web/app/[locale]/users/[id]/suivi/page.tsx:655`; apply same fix if present.
> 5. Add Jest test `apps/web/src/__tests__/profile-membersince.test.tsx` rendering the component with `createdAt: null`, `createdAt: '2026-01-15T10:00:00Z'`, and missing user.
> Commit: `fix(profile): BUG-06 guard Membre depuis formatting against null/invalid dates`.

---

### Task 1.6 — BUG-07: Account shown inactive

**Files:**
- Modify: `apps/web/app/[locale]/profile/page.tsx` (and/or relevant badge component)

**Subagent prompt:**

> Fix BUG-07. The connected account is shown as inactive despite being operational.
> 1. Grep for how the "inactif" badge is computed in the profile and user-suivi pages.
> 2. Likely root-cause: badge reads `user.isActive` but the store hydration provides `user.active` or vice-versa; or the field is missing from the `/auth/me` payload.
> 3. Verify what `/auth/me` returns (`apps/api/src/auth/auth.controller.ts:95-106`) and what the User DTO exposes.
> 4. Fix at whichever end is authoritative — prefer exposing `isActive` from `/auth/me` if missing; frontend then reads that.
> 5. Add Jest test asserting the badge renders "Actif" for `isActive: true`.
> Commit: `fix(profile): BUG-07 render correct active status from /auth/me`.

---

### Wave 1 Checkpoint

Main session:
1. Await all 6 subagent reports.
2. Run `pnpm run build` at repo root.
3. Run `pnpm --filter @orchestra/api test -- auth` and `pnpm --filter @orchestra/web test -- profile`.
4. `git log --oneline -10` — verify 6 commits.
5. `git push origin master` + deploy to VPS (per user memory).
6. Proceed to Wave 2.

---

## WAVE 2 — Ownership Transverse Layer (1 sequential + 5 parallel)

### Task 2.0 — Shared ownership primitives (RUN FIRST, sequential)

**Subagent prompt (Opus, run alone, wait for completion):**

> Build the shared ownership enforcement layer. The audit SEC-06 reports IDOR on leaves/telework/time-tracking; BUG-04/05/08 extend this to projects/events.
> 1. Create `apps/api/src/common/services/ownership.service.ts` — injectable service with one public method:
>    ```ts
>    async isOwner(resource: 'leave' | 'telework' | 'timeEntry' | 'project' | 'event', resourceId: string, userId: string): Promise<boolean>
>    ```
>    Each branch does a minimal Prisma findUnique selecting only the owner/creator field. For `project`, ownership means `project.ownerId === userId || project.members.some(m => m.userId === userId && m.role in ['LEAD','OWNER'])`. For `event`, `event.createdById === userId`.
> 2. Create `apps/api/src/common/decorators/ownership-check.decorator.ts` — `@OwnershipCheck({ resource, paramKey = 'id' })` that stores metadata via `SetMetadata('ownership', ...)`.
> 3. Create `apps/api/src/common/guards/ownership.guard.ts` — reads metadata, injects `OwnershipService`, reads `request.params[paramKey]` and `request.user.id`, calls `isOwner`. On false: throws `ForbiddenException('Resource ownership violation')`. **BYPASS**: if `request.user` has permission `<resource>:manage_any` (via existing permission system used by `canManageLeave` pattern in `leaves.service.ts:39-84`), allow. This preserves manager/admin overrides.
> 4. Register the guard and service in `apps/api/src/common/common.module.ts` (create if missing) and import in `app.module.ts`.
> 5. Write Vitest unit tests `apps/api/src/common/guards/ownership.guard.spec.ts` covering: owner pass, non-owner fail, privileged-role bypass, missing-resource 404.
> 6. `pnpm --filter @orchestra/api test` must pass.
> Commit: `feat(security): SEC-06 shared ownership guard and decorator`.

**Acceptance:** New files exist, unit tests green, no existing module regresses.

---

### Tasks 2.1 → 2.5 — Apply ownership per module (parallel)

Each subagent gets the same template, differing only in module name and specifics. Dispatch all 5 in parallel after Task 2.0 merges.

#### Task 2.1 — projects (BUG-04, BUG-08)

> Apply `@OwnershipCheck({ resource: 'project' })` + `OwnershipGuard` to `apps/api/src/projects/projects.controller.ts` on `PATCH /:id`, `DELETE /:id`, member add/remove endpoints. Additionally, in `apps/api/src/projects/projects.service.ts` `update`, `remove`, `updateMember`, `removeMember`: add an explicit check at the top that throws `ForbiddenException` if the current user is not the project owner AND lacks `projects:manage_any`. Use the existing permission-check pattern already used in the service. Add Vitest coverage asserting a non-owner CONTRIBUTEUR receives 403 on PATCH/DELETE. Commit: `fix(security): SEC-06/BUG-04/BUG-08 enforce project ownership on mutations`.

#### Task 2.2 — events (BUG-05)

> Same treatment on `apps/api/src/events/events.controller.ts` for `PATCH /:id`, `DELETE /:id`, `addParticipant`, `removeParticipant`. Service-level check: `event.createdById === currentUser.id` OR permission `events:manage_any`. Vitest: non-creator CONTRIBUTEUR gets 403. Commit: `fix(security): SEC-06/BUG-05 enforce event creator-ownership on mutations`.

#### Task 2.3 — telework (BUG-01)

> Audit `apps/api/src/telework/telework.service.ts` — checks already exist at :45-53, :288-294, :419-425, :496-502. **Verify completeness** against BUG-01 ("modify TTV of other users from planning page"). Specifically inspect the planning-page endpoints (search telework controller for routes hit from the planning view) and ensure service-level ownership + manager-perimeter checks run before any write. Add `@OwnershipCheck` on controller routes where missing. Write an E2E placeholder file `e2e/tests/security/telework-ownership.spec.ts` (Wave 5 will flesh it out). Commit: `fix(security): SEC-06/BUG-01 close telework ownership gaps on planning mutations`.

#### Task 2.4 — time-tracking

> `apps/api/src/time-tracking/time-tracking.service.ts` has `resolveActor` at :127-143 but update/delete paths (grep the service) lack explicit `ForbiddenException` on ownership. Add: in `update(id, dto, user)` and `remove(id, user)`, first `findUniqueOrThrow({ id })`, then assert `entry.userId === user.id || hasPermission(user, 'time_tracking:manage_any')`, else throw. Add Vitest. Commit: `fix(security): SEC-06 enforce time-tracking entry ownership on update/delete`.

#### Task 2.5 — leaves (verification)

> Verification pass only. `apps/api/src/leaves/leaves.service.ts` has extensive checks (:110, :904-908, :934-947, :1066-1075, :1352-1353, :1550). Grep every public service method for a non-protected write path. If any is missing a check, add one matching the existing `canManageLeave` pattern. If none missing, write a short report in the commit body. Commit (only if changes): `chore(security): SEC-06 leaves ownership verification pass`, else skip commit and just report.

---

### Wave 2 Checkpoint

Main session: build, run `pnpm --filter @orchestra/api test`, review all commits, push, deploy.

---

## WAVE 3 — Session Hardening (2 parallel)

### Task 3.1 — SEC-03: Role out of localStorage

**Subagent prompt:**

> Fix SEC-03 (CRITIQUE). `apps/web/src/services/auth.service.ts:8-9,17-18,25` persists full user JSON (including `role`) in localStorage; `apps/web/src/stores/auth.store.ts:28` writes `localStorage.setItem("user", ...)`.
>
> 1. Modify `auth.service.ts` to persist ONLY `{ id, email, firstName, lastName, avatarUrl }` under key `auth_user_display` (no role, no permissions).
> 2. Modify `auth.store.ts` to remove all localStorage user writes; role + permissions are held only in Zustand state (ephemeral, lost on refresh).
> 3. Create `apps/web/src/hooks/useAuthBootstrap.ts`:
>    ```ts
>    export function useAuthBootstrap() {
>      useEffect(() => {
>        const token = localStorage.getItem('access_token');
>        if (!token) return;
>        Promise.all([api.get('/auth/me'), api.get('/auth/me/permissions')])
>          .then(([me, perms]) => authStore.getState().setAuth(me.data, perms.data))
>          .catch(() => authStore.getState().clear());
>      }, []);
>    }
>    ```
> 4. Wire `useAuthBootstrap()` in `apps/web/app/[locale]/layout.tsx` root client provider.
> 5. Audit every call site that reads `role` from localStorage directly. Grep `localStorage.getItem` in `apps/web/src` and fix each.
> 6. **Backend defense-in-depth:** every `@Roles()` decorator use + `RolesGuard` already validates server-side — confirm no endpoint trusts client-sent role. Add a sanity Vitest test asserting `RolesGuard` ignores request body/headers for role.
> 7. Jest test: `auth.store.test.ts` — on `setAuth`, localStorage does NOT contain role/permissions.
> Commit: `fix(security): SEC-03 remove role and permissions from localStorage, hydrate from /auth/me`.

**Acceptance:** In devtools, Application → localStorage shows NO `role` / `permissions`. Tampering `auth_user_display` does not grant privileges (next API call 401s or returns unauthorized).

---

### Task 3.2 — SEC-04: Refresh tokens + Redis blacklist

**Subagent prompt:**

> Fix SEC-04. No refresh flow exists; JWT 8h with no revocation.
>
> 1. **Schema:** add to `packages/database/prisma/schema.prisma`:
>    ```prisma
>    model RefreshToken {
>      id         String   @id @default(uuid())
>      userId     String
>      user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
>      tokenHash  String   @unique
>      expiresAt  DateTime
>      revokedAt  DateTime?
>      userAgent  String?
>      ip         String?
>      createdAt  DateTime @default(now())
>      @@index([userId])
>    }
>    ```
>    Migration: `add-refresh-tokens`.
> 2. **Services:**
>    - `apps/api/src/auth/refresh-token.service.ts` — `issue(userId, meta)`, `rotate(refreshToken)`, `revoke(refreshToken)`, `revokeAllForUser(userId)`. Store `sha256(token)` not plaintext. TTL from `JWT_REFRESH_TTL` env (default `7d`).
>    - `apps/api/src/auth/jwt-blacklist.service.ts` — Redis-backed. `blacklist(jti, ttl)` sets `jwt:blacklist:<jti>` with TTL matching remaining token life; `isBlacklisted(jti)` checks.
> 3. **JWT:**
>    - Shorten access TTL to `JWT_ACCESS_TTL=15m` (new env var, fallback 15m).
>    - Include `jti` claim (uuid) in every access token (modify `auth.service.ts` sign call).
>    - `jwt.strategy.ts` validate step: if `await blacklist.isBlacklisted(payload.jti)` → throw `UnauthorizedException`.
> 4. **Endpoints in `auth.controller.ts`:**
>    - `POST /auth/refresh` — body `{ refreshToken }`; returns new `{ accessToken, refreshToken }` (rotation; old refresh revoked).
>    - `POST /auth/logout` — requires JWT; blacklists current JTI until its exp; revokes the provided refresh token too (body optional).
> 5. **Frontend interceptor** `apps/web/src/lib/api.ts`: on 401, try `/auth/refresh` once (queue concurrent requests to avoid stampede), retry original request; on failure redirect to login. Persist `refresh_token` in localStorage (same risk class as access token, documented).
> 6. **Tests:** Vitest for refresh rotation, blacklist isolation; Jest for frontend interceptor retry logic.
> Commit: `feat(security): SEC-04 add refresh tokens and Redis JWT blacklist`.

**Acceptance:** `/auth/logout` followed by a call using the old access token returns 401. Refresh returns new pair and revokes the old refresh.

---

### Wave 3 Checkpoint

Migration on dev DB, full build, all auth E2E green, push, deploy. **Announce to user** that prod needs `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL` envs before deploy.

---

## WAVE 4 — Upload Validation + Remaining Bugs (3 parallel)

### Task 4.1 — SEC-07: Magic bytes validator

**Subagent prompt:**

> Fix SEC-07. `file-type@19` is installed; currently used only at `users.service.ts:1288-1292` (avatar).
> 1. Create `apps/api/src/common/upload/magic-bytes.validator.ts`:
>    ```ts
>    const WHITELIST = {
>      image: ['image/png', 'image/jpeg', 'image/webp'],
>      document: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
>    } as const;
>    export async function assertMagicBytes(buffer: Buffer, kind: keyof typeof WHITELIST) {
>      const result = await fileTypeFromBuffer(buffer);
>      if (!result) throw new BadRequestException('Unknown file type');
>      if (!WHITELIST[kind].includes(result.mime)) {
>        throw new BadRequestException(`Disallowed mime: ${result.mime}`);
>      }
>      return result;
>    }
>    ```
> 2. Refactor `users.service.ts` avatar upload to use this validator.
> 3. Audit every multipart route in the API (grep `@fastify/multipart`, `file()`, `Multipart`). If any other route handles uploads, wire the validator. If `documents.service.ts` actually persists uploaded bytes somewhere (re-check — it looked metadata-only), add validation.
> 4. Vitest: feeds a `.php` renamed `.jpg` buffer → throws; real PNG → passes.
> Commit: `fix(security): SEC-07 centralize magic-bytes validation for uploads`.

---

### Task 4.2 — BUG-02: TaskForm assignee blink

**Subagent prompt:**

> Fix BUG-02. `apps/web/src/components/tasks/TaskForm.tsx` shows a blink when assignees aren't resolved.
> 1. Read the component; find where assignees are fetched (likely a `useQuery` for users) and where they're rendered.
> 2. Root cause: render happens before users are resolved; mounted-default shows an empty state that flips to populated.
> 3. Fix options (pick whichever matches codebase conventions already used in neighboring components):
>    - Render a `<Skeleton>` for the assignee section while `isLoading`, OR
>    - Pre-fetch users via a `useSuspenseQuery` with Suspense boundary.
> 4. Verify visually: start dev server, open the form, no blink.
> 5. Jest test asserting skeleton renders when `isLoading=true`.
> Commit: `fix(tasks): BUG-02 prevent assignee blink in TaskForm`.

---

### Task 4.3 — BUG-03: Planning default services

**Subagent prompt:**

> Fix BUG-03. `apps/web/app/[locale]/planning/page.tsx` loads with no service selected; user must manually select all to see anything.
> 1. Inspect `apps/web/src/stores/planningView.store.ts` and `apps/web/src/hooks/usePlanningData.ts`.
> 2. In the store initializer (or on first data fetch), if `selectedServices` is empty AND available services list is non-empty → default to all services selected.
> 3. Preserve user choice afterwards (persist middleware already does this per repo map; ensure we don't overwrite user's explicit empty selection — only default when `selectedServices === undefined`, not when `=== []`).
> 4. Jest test on the store: first mount with services → all selected; subsequent manual clear → empty stays empty.
> Commit: `fix(planning): BUG-03 default-select all services on first mount`.

---

### Wave 4 Checkpoint

Build, tests, push, deploy.

---

## WAVE 5 — E2E Coverage + Final Verification (3 parallel + 1 sequential)

### Task 5.1 — Ownership IDOR E2E

> Create `e2e/tests/security/ownership-idor.spec.ts`. Using the permission matrix at `e2e/fixtures/permission-matrix.ts` and `asRole()` fixture, for each of leaves, telework, time-tracking, projects, events:
> - Create a resource as user A
> - Attempt `PATCH /:id` and `DELETE /:id` as user B (same role tier, different user)
> - Assert 403 Forbidden
> - Repeat as CONTRIBUTEUR, OBSERVATEUR, REFERENT_TECHNIQUE, MANAGER (outside perimeter)
> - ADMIN should succeed (bypass)
> Tag critical tests `@smoke`. Commit: `test(e2e): cross-user ownership IDOR coverage`.

### Task 5.2 — Auth hardening E2E

> Create `e2e/tests/security/auth-hardening.spec.ts`:
> - Tampering `auth_user_display` in localStorage → still unauthorized for admin endpoints (SEC-03).
> - 6 rapid logins with wrong pw → 429 after 5 (SEC-05).
> - Login → logout → reuse of access token → 401 (SEC-04).
> - Refresh flow: old refresh after rotation → 401 (SEC-04).
> Commit: `test(e2e): auth hardening coverage (SEC-03/04/05)`.

### Task 5.3 — Upload validation E2E

> Create `e2e/tests/security/upload-validation.spec.ts`:
> - Upload a `.php` renamed `.jpg` to avatar → 400.
> - Upload a real PNG → 200.
> Commit: `test(e2e): magic-bytes upload validation (SEC-07)`.

### Task 5.4 — Final verification pass (sequential, main session)

Main session does this itself:
1. `pnpm run build` — must pass.
2. `pnpm run test` — all units green.
3. `pnpm run test:e2e --grep @smoke` — smoke suite green.
4. Dispatch `superpowers:code-reviewer` subagent reviewing full plan-vs-diff.
5. Dispatch `security-review` skill on the whole diff since start of plan.
6. Create `docs/security/REMEDIATION_STATUS.md` mapping every SEC-* and BUG-* to commit SHA + status.
7. Final commit: `docs(security): remediation status doc for 2026-04-15 audit`.
8. Push, deploy.
9. Report to user.

---

## Acceptance Criteria (global)

- [ ] All 8 SEC findings closed with commits referencing the SEC ID
- [ ] All 8 BUGs closed with commits referencing the BUG ID
- [ ] `pnpm run build` green
- [ ] `pnpm run test:e2e --grep @smoke` green
- [ ] No localStorage entry contains `role` or `permissions`
- [ ] `admin/admin123` cannot be seeded in `NODE_ENV=production`
- [ ] Swagger returns 401 without basic auth when `SWAGGER_USER` set, or is absent in prod
- [ ] Access token TTL = 15m, refresh token flow functional, logout revokes
- [ ] Fastify logs show `[REDACTED]` for passwords/authorization
- [ ] Cross-user mutation on leaves/telework/time-tracking/projects/events returns 403
- [ ] Upload of non-whitelisted mime returns 400
- [ ] `docs/security/REMEDIATION_STATUS.md` exists and is accurate

---

## Risk Notes

- **Schema migration in Wave 1 (Task 1.1) and Wave 3 (Task 3.2)**: two migrations total. The Wave 3 `RefreshToken` model requires a `prisma migrate deploy` on VPS — confirm before deploy.
- **localStorage role removal (SEC-03)** may break any component that branches on `localStorage.getItem('user').role`. Wave 3 subagent must grep exhaustively.
- **Throttle tightening (SEC-05)** may break existing E2E that login-spams. Update those tests if present (grep `auth/login` in `e2e/`).
- **Refresh-token rollout**: existing sessions invalidated on deploy (users must re-login once). Acceptable; announce to user.
- **Autonomous chaining**: main session halts and asks user if any subagent reports a build failure or ambiguous root-cause requiring decision.
