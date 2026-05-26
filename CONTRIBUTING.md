# Contributing to Orchestr'A

Merci de votre intérêt pour Orchestr'A !

## Comment contribuer

### Signaler un bug

1. Vérifiez que le bug n'a pas déjà été signalé dans les [Issues](https://github.com/ElegAlex/Orchestr-A/issues)
2. Créez une issue avec :
   - Description claire du bug
   - Étapes pour reproduire
   - Comportement attendu vs observé
   - Environnement (OS, Node.js, Docker, navigateur)

### Proposer une fonctionnalité

1. Ouvrez une issue avec le label `enhancement`
2. Décrivez le besoin métier et la solution envisagée
3. Attendez la validation avant de coder

### Soumettre du code

1. Forkez le repo
2. Créez une branche (`git checkout -b feature/ma-fonctionnalite`)
3. Respectez les conventions du projet :
   - TypeScript strict
   - ESLint + Prettier (lancez `pnpm run lint` et `pnpm run format`)
   - Tests unitaires pour toute nouvelle logique
4. Commitez avec des messages conventionnels (`feat:`, `fix:`, `docs:`, `chore:`)
5. Ouvrez une Pull Request vers `master`

### Prérequis de développement

- Node.js >= 22.0.0
- pnpm 9.x
- Docker & Docker Compose v2+

### Lancer le projet en local

```bash
git clone https://github.com/ElegAlex/Orchestr-A.git
cd Orchestr-A
pnpm install
pnpm run docker:dev    # PostgreSQL + Redis
pnpm run db:migrate
pnpm run db:seed
pnpm run dev
```

### Tests

Trois suites distinctes, **additives** (chacune indépendante des autres) :

| Commande | Périmètre | Base de données |
|----------|-----------|-----------------|
| `pnpm test` | Tests unitaires (`*.spec.ts`) | **Mockée** — `vi.mock('database')` dans `apps/api/vitest.setup.ts`. Aucun Postgres requis. |
| `pnpm test:integration` | Intégration réelle (`*.int.spec.ts`) | **Réelle** — base éphémère provisionnée par migration. |
| `pnpm test:e2e` | E2E (Playwright + boot app, Prisma mocké) | Mockée. |

**Quand écrire un test d'intégration plutôt qu'un test unitaire ?**
Uniquement pour ce qui dépend de la sémantique réelle de Postgres et qui est donc invisible au mock : triggers (immutabilité `audit_logs`), actions référentielles des clés étrangères (`ON DELETE NO ACTION` / `SET NULL`), contraintes de schéma, colonnes générées, comportement du SQL brut. Toute logique applicative pure reste en test unitaire mocké (rapide, sans I/O).

**Mécanisme (TST-DB-001).** `apps/api/vitest.int.config.ts` est un projet vitest séparé : motif de fichiers `src/**/*.int.spec.ts`, setup `vitest.int.setup.ts` (qui **n'**applique **pas** `vi.mock('database')`), et un `globalSetup` (`vitest.int.global-setup.ts`) qui :
1. se connecte au Postgres fourni (variable `DATABASE_URL`, ou la base dev `:5433` par défaut) ;
2. `CREATE DATABASE` une base éphémère unique (`orchestr_a_int_<pid>_<timestamp>`) ;
3. y applique **toutes** les migrations via `prisma migrate deploy` (schéma réel, pas de fixtures) ;
4. expose un vrai `PrismaClient` aux tests ;
5. `DROP DATABASE … WITH (FORCE)` en teardown — aucune base résiduelle.

**Lancer en local :**

```bash
pnpm run docker:dev          # Postgres doit tourner (dev container :5433 par défaut)
pnpm test:integration        # crée/migre/teste/supprime une base éphémère
```

**Prérequis CI.** La suite tourne dans le job `backend-tests` (cf. `.github/workflows/ci.yml`), qui fournit déjà un service `postgres:18` et un utilisateur superuser (donc `CREATEDB`). Aucun Docker-in-Docker ni testcontainers n'est requis : le harness crée une base éphémère **sur le Postgres déjà provisionné**.

## Code de conduite

Ce projet adhère au [Contributor Covenant](CODE_OF_CONDUCT.md). En participant, vous vous engagez à respecter ses termes.
