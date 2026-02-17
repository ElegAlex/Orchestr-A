# ORCHESTR'A V2

Application de gestion de projets et RH pour collectivités territoriales. Monorepo Turborepo. Licence MIT.

## Stack

- API : NestJS 11 + Fastify 5, Prisma 6, PostgreSQL 18, Redis 7.4
- Frontend : Next.js 16 App Router, React 19, TanStack Query, Zustand, Tailwind 4, Radix UI
- Tests : Vitest (API, `*.spec.ts`), Jest (Frontend, `*.test.ts`), Playwright (E2E)
- Infra : Docker Compose, Nginx

## Structure

```
apps/api/src/[module]/     → controller + service + dto + tests
apps/web/app/[page]/       → pages Next.js (App Router uniquement)
apps/web/src/components/   → composants React
apps/web/src/services/     → services API Axios (1 par domaine)
apps/web/src/stores/       → stores Zustand
apps/web/src/hooks/        → hooks custom
packages/database/prisma/  → schema.prisma (source de vérité unique)
packages/types/            → types partagés API ↔ Frontend
```

## Commandes

```bash
pnpm run build        # Build complet — toujours vérifier avant de livrer
pnpm run test         # Tests unitaires
pnpm run dev          # Dev mode
pnpm run docker:dev   # PostgreSQL + Redis
pnpm run db:migrate   # Prisma migrate dev
pnpm run db:seed      # Seed (login: admin / admin123)
```

Toujours `pnpm`, jamais npm ni yarn.

## Conventions

Suivre les patterns existants. Référence : `apps/api/src/tasks/` et `apps/web/app/tasks/`.

- Backend : modules NestJS, DTOs class-validator, PrismaService singleton, exceptions NestJS
- Frontend : services Axios, stores Zustand, React Hook Form + Zod, Tailwind + Radix UI
- Auth : JwtAuthGuard + RolesGuard, décorateurs @CurrentUser() et @Roles()
- Nommage : kebab-case fichiers, PascalCase composants, `*.spec.ts` backend, `*.test.ts` frontend

## Rôles RBAC

ADMIN > RESPONSABLE > MANAGER > REFERENT_TECHNIQUE > CONTRIBUTEUR > OBSERVATEUR

## Vérification obligatoire

Avant tout travail, vérifier que le codebase existe et que l'environnement fonctionne :

```bash
echo "Fichiers API : $(find apps/api/src -name '*.ts' 2>/dev/null | wc -l)"
echo "Fichiers Web : $(find apps/web -name '*.tsx' -o -name '*.ts' 2>/dev/null | wc -l)"
docker ps --format '{{.Names}}' | grep -E "postgres|redis" || echo "⚠️ Docker manquant"
pnpm run build 2>&1 | tail -3
```

Si des fichiers source existent → travailler avec le code existant. Ne JAMAIS recréer des fichiers existants. L'absence de .git ne signifie pas repo vide. Si un check échoue → le corriger AVANT de commencer.

## Pièges connus

- schema.prisma = un seul fichier, un seul éditeur à la fois en agent team
- Tâches sans projet = intentionnel (réunions, transverse), pas un bug
- Personal Todos : limite 20 items hard-codée
- JWT dans localStorage : choix conscient, ne pas migrer sans demande
- Soft delete projets : status CANCELLED, hard delete via endpoint séparé
- Next.js 16 + React 19 : vérifier compatibilité libs tierces

## Pour aller plus loin

- Routes API (107 endpoints) : Swagger à `/api/docs` en dev
- Schéma complet : `packages/database/prisma/schema.prisma`
- Docker prod : `docker-compose.prod.yml`
- CI/CD : `.github/workflows/`
