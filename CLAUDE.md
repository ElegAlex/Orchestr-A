# ORCHESTR'A V2

@CLAUDE-OPTIMIZATION.md

Project and HR management application for French local government. Turborepo monorepo. MIT licensed.

## Stack

- API: NestJS 11 + Fastify 5, Prisma 6, PostgreSQL 18, Redis 7.4
- Frontend: Next.js 16 App Router, React 19, TanStack Query, Zustand, Tailwind 4, Radix UI
- Tests: Vitest (API, `*.spec.ts`), Jest (Frontend, `*.test.ts`), Playwright (E2E)
- Infra: Docker Compose, Nginx

## Structure

```
apps/api/src/[module]/     → controller + service + dto + tests
apps/web/app/[page]/       → Next.js pages (App Router only)
apps/web/src/components/   → React components
apps/web/src/services/     → Axios API services (1 per domain)
apps/web/src/stores/       → Zustand stores
apps/web/src/hooks/        → custom hooks
packages/database/prisma/  → schema.prisma (single source of truth)
packages/types/            → shared types API ↔ Frontend
```

## Commands

```bash
pnpm run build        # Full build — always verify before shipping
pnpm run test         # Unit tests
pnpm run dev          # Dev mode
pnpm run docker:dev   # PostgreSQL + Redis
pnpm run db:migrate   # Prisma migrate dev
pnpm run db:seed      # Seed (login: admin / admin123)
```

Always `pnpm`, never npm or yarn.

## Conventions

Follow existing patterns. Reference: `apps/api/src/tasks/` and `apps/web/app/tasks/`.

- Backend: NestJS modules, class-validator DTOs, PrismaService singleton, NestJS exceptions
- Frontend: Axios services, Zustand stores, React Hook Form + Zod, Tailwind + Radix UI
- Auth: JwtAuthGuard + RolesGuard, `@CurrentUser()` and `@Roles()` decorators
- Naming: kebab-case files, PascalCase components, `*.spec.ts` backend, `*.test.ts` frontend

## RBAC roles

ADMIN > RESPONSABLE > MANAGER > REFERENT_TECHNIQUE > CONTRIBUTEUR > OBSERVATEUR

## Mandatory pre-flight check

Before any work, verify the codebase exists and the environment is up:

```bash
echo "API files: $(find apps/api/src -name '*.ts' 2>/dev/null | wc -l)"
echo "Web files: $(find apps/web -name '*.tsx' -o -name '*.ts' 2>/dev/null | wc -l)"
docker ps --format '{{.Names}}' | grep -E "postgres|redis" || echo "⚠️ Docker missing"
pnpm run build 2>&1 | tail -3
```

If source files exist → work with existing code. NEVER recreate existing files. Missing `.git` does not mean empty repo. If a check fails → fix it BEFORE starting.

## Known pitfalls

- `schema.prisma` = single file, one editor at a time in agent teams
- Tasks without a project = intentional (meetings, cross-cutting work), not a bug
- Personal Todos: hard-coded 20-item limit
- JWT in localStorage: deliberate choice, do not migrate without request
- Project soft-delete: status `CANCELLED`, hard delete via dedicated endpoint
- Next.js 16 + React 19: verify third-party lib compatibility
- Prod runs **air-gapped on Ramage** (CPAM internal network, behind Apache → `127.0.0.1:3000`): any code change must ALSO prepare an offline update package — see `docs/migration-cnam/2026-06-22-RUNBOOK-MAJ-PROD-Ramage.md` (tiered T0/T1/T2, backup-first, never replay the migration snapshot on live data)

## Further reading

- API routes (107 endpoints): Swagger at `/api/docs` in dev
- Full schema: `packages/database/prisma/schema.prisma`
- Prod Docker: `docker-compose.prod.yml`
- CI/CD: `.github/workflows/`

## E2E Testing

- Every feature/bugfix MUST include Playwright E2E tests
- Tests use the permission matrix in `e2e/fixtures/permission-matrix.ts`
- Each test covers all 6 roles: ADMIN, RESPONSABLE, MANAGER, REFERENT_TECHNIQUE, CONTRIBUTEUR, OBSERVATEUR
- Auth via API (never UI login in tests) using storage states in `playwright/.auth/`
- `asRole()` fixture for multi-role workflows
- Negative tests required: verify unauthorized roles get 403 or redirect
- Tag critical tests with `@smoke`
- Run all: `pnpm run test:e2e`
- Per role: `npx playwright test --project=admin`
- Multi-role: `npx playwright test --project=multi-role`
