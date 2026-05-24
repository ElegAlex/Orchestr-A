# Adversarial Code Review — ORCHESTR'A V2

**Date:** 2026-05-24
**Méthode:** 6 agents adversariaux parallèles, lecture seule, couvrant sécurité / correctness / data integrity / performance / observability / tests.
**Périmètre:** Monorepo complet (apps/api 290 .ts, apps/web 234 .ts/tsx, packages/, e2e/, migrations, CI).
**Total:** 173 findings — **30 blocking**, ~110 important, ~33 nit/suggestion.

---

## Résumé exécutif

### Verdict global
Le code est **fonctionnellement riche mais structurellement fragile**. Trois familles de risques bloquent la mise en production en l'état :

1. **Le journal d'audit est théâtral.** Les évènements RGPD/Cour des Comptes (login, approbation de congés, changement de rôle, accès aux documents) partent en `console.log` JSON et **ne sont pas persistés**. Deux implémentations d'audit coexistent (`AuditService` console-only vs `AuditPersistenceService` DB), aucune n'est reliée aux flux sensibles. Append-only « par convention ». Aucune retention. **Un auditeur ne peut pas reconstituer qui a approuvé quel congé à quelle date avec quelles permissions effectives au moment T.**

2. **Le RBAC V4 a un fond ouvert.** Le guard global `PermissionsGuardV2` est en mode `permissive` par défaut (variable d'env non documentée dans `.env.production.example`) — toute route qui oublie `@RequirePermissions` est ouverte à tout authentifié. Les checks de périmètre horizontal manquent sur `PATCH /users/:id`, `GET /users/:id`, `POST /users/:id/reset-password` (qui bypass la hiérarchie de rôles). Du code de bypass `if (userRole === 'ADMIN')` subsiste dans `epics` et `milestones` malgré la règle « no hardcoded roles ». Et la matrice de permissions E2E couvre **35 / 91** permissions déclarées par les contrôleurs.

3. **Les invariants métier vivent uniquement côté applicatif.** Pas de CHECK SQL sur `endDate ≥ startDate`, `progress ∈ [0,100]`, `balance ≥ 0`, `hours ≤ 24`. Float (double precision) pour les jours/heures/soldes — dérive d'arrondi à l'agrégation. `Leave` n'a **aucun index**. Pas de contrainte d'exclusion `EXCLUDE USING gist` empêchant des congés approuvés qui se chevauchent. Cascade `ON DELETE` qui purge l'historique RH (contradiction avec Code du Travail 5 ans).

### Top 10 findings bloquants (à corriger avant prochaine mise en prod)

| ID | Sujet | Fichier |
|----|-------|---------|
| OBS-001 | Audit log sur stdout uniquement, pas en base | `apps/api/src/audit/audit.service.ts:16` |
| OBS-002 | Append-only = convention, aucun trigger ni hash chain | `apps/api/src/audit/audit-persistence.service.ts:25` |
| OBS-004 | Changements de rôle utilisateur **jamais audités** | `apps/api/src/users/users.service.ts:432` |
| SEC-001 | Guard RBAC par défaut `permissive` — routes non décorées ouvertes | `apps/api/src/rbac/permissions.guard.ts:69` |
| SEC-002 | `PATCH /users/:id` sans check de périmètre horizontal | `apps/api/src/users/users.service.ts:342` |
| SEC-003 | `POST /users/:id/reset-password` bypass la hiérarchie de rôles | `apps/api/src/users/users.controller.ts:378` |
| COR-003 | Calcul de congés ne soustrait **pas les jours fériés** | `apps/api/src/leaves/leave-year-window.ts:71` |
| DAT-005 | `Float` (double) pour jours/heures/soldes — dérive d'arrondi | `packages/database/prisma/schema.prisma:411` |
| PER-010 | Modèle `Leave` n'a **aucun index** | `packages/database/prisma/schema.prisma:569` |
| TST-001 | Matrice de permissions E2E : 35/91 (61% non testées) | `e2e/fixtures/permission-matrix.ts:1` |

### Métriques clés

- **JWT access tokens non révoqués** lors d'un reset de mot de passe (fenêtre d'attaque ≤ 15 min)
- **0 trigger DB** sur audit_logs malgré le commentaire « append-only »
- **0 retention policy** sur audit_logs (Cour des Comptes attend 5-10 ans)
- **112 `console.*`** côté frontend sans logger ni scrubbing PII
- **0 Sentry / 0 métriques Prometheus / 0 request-id propagé**
- **18 `test.skip(!projectId, …)`** dans la suite IDOR (silencieusement verte si beforeAll échoue)
- **4 backups prod en clair**, dernier 2026-04-24, pas de rotation, pas de chiffrement
- **Workflow `deploy.yml`** = `echo` (ne déploie pas réellement — documenté en mémoire)

---

## Cluster analysis — causes racines partagées

### Cluster A — « L'audit est théâtral » (Cour des Comptes blocker)
**Findings :** OBS-001/002/003/004/005/006/007/012/018/020/021/024, DAT-001/002/009/021, TST-011 (17 findings).
**Cause racine :** Deux implémentations d'audit (`AuditService` Logger vs `AuditPersistenceService` Prisma) coexistent depuis un refactor inachevé. Aucun flux sensible (auth, congés, RBAC, documents, exports, backfills) n'est branché sur la version persistante. L'immutabilité est une convention en commentaire. Aucune politique de conservation, aucun hash chain, aucun snapshot du rôle/template au moment de la décision, aucun request-id propagé, aucune métrique.
**Remédiation transversale :** unifier les deux services en un seul écrivant en DB, ajouter un trigger Postgres BEFORE UPDATE/DELETE qui RAISE EXCEPTION, ajouter `(prevHash, rowHash)` pour l'intégrité chaînée, snapshot `{actor.roleCode, templateKey, permissions[]}` à chaque évènement, partitionnement mensuel + archivage WORM, propagation request-id Nginx → Fastify → audit_logs.

### Cluster B — « Le RBAC V4 a un fond ouvert »
**Findings :** SEC-001/002/003/030, COR-001/002/028, TST-001/013/018 (10 findings).
**Cause racine :** La migration RBAC V4 a livré la couche de résolution (templates, ROLE_TEMPLATES, cache Redis) mais pas la couverture exhaustive des surfaces. Guard global en mode `permissive`, checks de périmètre horizontal absents sur les ressources `users`, code legacy `if (userRole === 'ADMIN')` subsistant, matrice E2E figée sur 35 permissions, assertion `not.toBe(403)` qui passe sur 404.
**Remédiation transversale :** flipper le défaut du guard sur `enforce` + boot-assert en prod, intégrer `AccessScopeService` dans `users` et `leaves` côté reads, remplacer les comparaisons `userRole === 'ADMIN'` par des permissions, générer la matrice E2E depuis `grep @RequirePermissions` avec test de complétude.

### Cluster C — « Date/calendrier en deux implémentations parallèles »
**Findings :** COR-003/007/012/013/023/026/027, DAT-013/015 (9 findings).
**Cause racine :** Coexistence d'une bibliothèque correcte (`parisYearWindow`, `splitLeaveByYear`, `formatInTimeZone`) ET d'arithmétique ad-hoc avec `new Date(year, 0, 1)` (timezone-dépendante) dans `getLeaveBalance`, `telework.create`, `holidays.findByYear`. Pas de soustraction des jours fériés dans le moteur de calcul de congés. Heures `HH:MM` stockées comme String. Email sans citext.
**Remédiation transversale :** retirer toute arithmétique `new Date(y, m, d)` au profit du module Paris-aware ; faire entrer les holidays dans `calculateLeaveDays` ; migrer `Holiday.date`, `TeleworkSchedule.date`, `SchoolVacation.{startDate,endDate}` en `@db.Date` ; centraliser un `DateRangeValidator`.

### Cluster D — « Mutations sans atomicité ni verrouillage »
**Findings :** DAT-001/006/024, COR-008/009/014/018/019/024, PER-003 (10 findings).
**Cause racine :** Pattern systémique « `findUnique` puis `update` » sans `WHERE status = ?` conditionnel, sans `$transaction`, sans version optimiste, sans serialization. Approve/reject de congés peut être doublé. Approve ne re-vérifie pas le solde après mutation admin entre PENDING et APPROVED. Reorder de subtasks en `Promise.all`. Imports CSV hors tx. Snapshots projet idempotents par convention seulement.
**Remédiation transversale :** convertir toutes les transitions de statut en `updateMany({ where: { id, status: required }, … })` et vérifier `count === 1` ; envelopper mutate+audit dans `$transaction` partagé ; ajouter index unique `(projectId, dayBucket)` sur snapshots + upsert ; ajouter colonne `version` optimiste sur Leave/Project/Task.

### Cluster E — « Hot paths non-indexés, fan-out N+1, pagination décorative »
**Findings :** PER-001/002/003/004/005/006/007/009/010/011/012/013/015/016/025, DAT-010/011 (17 findings).
**Cause racine :** Modèle `Leave` n'a **aucun index** malgré 8 hot predicates. User/Event/Task manquent des index sur FK et dates. Pagination par défaut 1000 (effectivement unbounded). Planning Overview enchaîne 5+ subqueries unbounded. Analytics et leave balance en N+1 (`map(async)` au lieu de `groupBy`). Le scope manager est recalculé 4 fois par requête sans cache de scope.
**Remédiation transversale :** audit exhaustif des `@@index` (au moins 15 manquants identifiés), bascule des reductions JS en `prisma.groupBy`, séparation des endpoints CRUD vs view-model planning (read-model dédié), introduction d'un `CacheService` Redis pour les endpoints chers (analytics, planning, presence, balance).

### Cluster F — « Invariants métier absents du SQL »
**Findings :** DAT-003/004/005/012/013/014/016/017/018/023, COR-022 (11 findings).
**Cause racine :** Le schéma traite Postgres comme un dépôt passif. Aucun CHECK sur `endDate ≥ startDate`, `progress ∈ [0,100]`, `balance ≥ 0`, `hours ≤ 24`. `Float` pour les valeurs monétaires/temporelles → dérive d'arrondi à l'agrégation. `String` au lieu d'enum sur `defaultDuration`, `completionStatus`, `recurrenceType`. Pas de `@@unique` sur `Department.name` / `Service.name`. Pas de `EXCLUDE USING gist` empêchant le chevauchement de congés approuvés. Pas de cycle prevention sur `TaskDependency`. Legacy `LeaveType` enum subsistant en parallèle de `leaveTypeId`.
**Remédiation transversale :** une migration « defensive schema » ajoutant : CHECK constraints sur toutes les ranges/quotas, conversion `Float → Decimal(6,2)`, promotion des enum candidats, ajout de `@@unique` métier, `CREATE EXTENSION btree_gist` + EXCLUDE USING gist sur Leave, drop colonne `leaves.type` après vérification.

### Cluster G — « Cascade destructive vs obligations de conservation »
**Findings :** DAT-007/008/022/025/026 (5 findings).
**Cause racine :** Cascade `ON DELETE` choisi pour la commodité du nettoyage en dev, en conflit avec le Code du Travail (conservation 5 ans des congés) et avec le besoin de reconstitution Cour des Comptes. Hard-delete d'un projet purge snapshots/tasks/documents/events. Hard-delete d'un user purge leave/timeentry history. Department delete null-ifie silencieusement le rattachement RBAC. Document.uploadedBy n'a pas de FK. User n'a pas de `deletedAt`.
**Remédiation transversale :** remplacer hard-delete par soft-delete + anonymisation RGPD pour User ; passer `Leave.user` → `SetNull` avec snapshot des nom/prénom au moment de la suppression ; ajouter audit row sur department delete (trigger) ; ajouter FK + index sur `Document.uploadedBy`.

### Cluster H — « Suite de tests théâtralement verte »
**Findings :** TST-003/004/005/006/007/009/010/013/014/015/017/019 (12 findings).
**Cause racine :** Pattern `test.skip(!projectId, "creation failed in beforeAll")` qui rend la suite verte quand le setup échoue. Assertions tautologiques (`isApproved || url.includes('/leaves')`). Mock de `$transaction` qui re-passe le client host, désactivant les sémantiques tx. `expect().not.toBe(403)` qui passe sur 404/500. `it.skip()` avec TODOs jamais reprises. UI logins dans des tests E2E malgré CLAUDE.md. Pas de reset DB entre suites E2E.
**Remédiation transversale :** remplacer `test.skip(!id, …)` par `expect(id).toBeDefined()`, exiger des status précis par endpoint dans la matrice, ajouter un test de complétude qui diff `@RequirePermissions` ↔ matrice, ajouter un spec d'intégration Postgres réel pour les tx serializable, supprimer les fichiers E2E legacy avec UI login.

### Cluster I — « Frontend sans couche de données partagée »
**Findings :** PER-017/018/019/020/021/028, OBS-016 (7 findings).
**Cause racine :** Convention « `"use client"` + `useEffect` + axios + setState ». TanStack Query branché sur 3 composants seulement (sur ~200). Pas de RSC pour les pages list/détail. Pas de `dynamic()` sur charts/gantt. Pas de bundle-analyzer. 112 `console.*` sans logger central ni scrubbing.
**Remédiation transversale :** roll-out TanStack Query (hooks `useUsers/useProjects/useTasks/useLeaves` avec staleTime 30-60s) ; convertir les pages list en RSC ; ajouter `experimental.optimizePackageImports` ; introduire `apps/web/src/lib/logger.ts` + ESLint `no-console`.

### Cluster J — « Upload de fichiers et champs URL = sinks XSS / path-traversal / SSRF »
**Findings :** SEC-009/010/011/015/016/017/018/024 (8 findings).
**Cause racine :** Champs URL (`Document.url`, `User.avatarUrl`) acceptés comme `@IsString` sans validation de schéma. Suppression d'avatar dérive le chemin filesystem du champ DB sans validation → arbitrary file delete. Static `/api/uploads/` servi sans authentification (fastifyStatic ne traverse pas les guards Nest). `AUTH_EXPOSE_RESET_TOKEN=true` dans `.env.example`. `fetch()` externe sans timeout.
**Remédiation transversale :** `@IsUrl({protocols:['https']})` + maxLength sur tout champ URL, reconstruction systématique du chemin filesystem depuis `userId`+ext whitelistée (jamais depuis la DB), middleware fastify d'auth sur `/api/uploads/`, allowlist MIME stricte avec magic-bytes en streaming.

### Cluster K — « Auth subsystem : défenses en profondeur manquantes »
**Findings :** SEC-004/005/006/007/013/014/019/021/022/023, OBS-008/013 (12 findings).
**Cause racine :** `forcePasswordChange` écrit en seed mais jamais lu. Login différencie « bad password » vs « disabled account » → user enumeration. Throttle 30/min trop permissif pour brute-force distribué. Politique de mot de passe asymétrique (register strict, import bypass). `trustProxy` non activé sur Fastify → IPs réelles invisibles, throttler dégradé. Refresh cookie sans préfixe `__Host-`, SameSite=Lax. JWT access NON invalidés sur password reset (fenêtre 15 min). Blacklist Redis fail-soft sur write. CSP `unsafe-inline` à 2 niveaux (helmet + nginx).
**Remédiation transversale :** un commit « auth hardening pass » : ajouter `nbf` Redis par user bumpé sur password-reset/role-change, activer `trustProxy: true`, préfixer le cookie `__Host-`, fail-closed sur le blacklist write, uniformiser la politique de mot de passe via décorateur partagé, retirer `unsafe-inline` côté Nginx et passer en nonces.

---

## JSON structuré complet

Les findings ci-dessous sont fournis par catégorie. Référence ID : `SEC-NNN` (security), `COR-NNN` (correctness), `DAT-NNN` (data integrity), `PER-NNN` (performance), `OBS-NNN` (observability), `TST-NNN` (tests).

```json
{
  "report": "ORCHESTRA V2 — Adversarial code review",
  "date": "2026-05-24",
  "totals": {
    "findings": 173,
    "blocking": 30,
    "important": 110,
    "nit_or_suggestion": 33,
    "by_category": {
      "security": 30,
      "correctness": 33,
      "data_integrity": 30,
      "performance": 30,
      "observability": 25,
      "tests": 25
    }
  },
  "clusters": [
    {"id": "A", "title": "Audit log théâtral", "findings": ["OBS-001","OBS-002","OBS-003","OBS-004","OBS-005","OBS-006","OBS-007","OBS-012","OBS-018","OBS-020","OBS-021","OBS-024","DAT-001","DAT-002","DAT-009","DAT-021","TST-011"]},
    {"id": "B", "title": "RBAC V4 fond ouvert", "findings": ["SEC-001","SEC-002","SEC-003","SEC-030","COR-001","COR-002","COR-028","TST-001","TST-013","TST-018"]},
    {"id": "C", "title": "Date/TZ en double implémentation", "findings": ["COR-003","COR-007","COR-012","COR-013","COR-023","COR-026","COR-027","DAT-013","DAT-015"]},
    {"id": "D", "title": "Mutations sans atomicité", "findings": ["DAT-001","DAT-006","DAT-024","COR-008","COR-009","COR-014","COR-018","COR-019","COR-024","PER-003"]},
    {"id": "E", "title": "Hot paths N+1 / non-indexés", "findings": ["PER-001","PER-002","PER-003","PER-004","PER-005","PER-006","PER-007","PER-009","PER-010","PER-011","PER-012","PER-013","PER-015","PER-016","PER-025","DAT-010","DAT-011"]},
    {"id": "F", "title": "Invariants métier absents du SQL", "findings": ["DAT-003","DAT-004","DAT-005","DAT-012","DAT-013","DAT-014","DAT-016","DAT-017","DAT-018","DAT-023","COR-022"]},
    {"id": "G", "title": "Cascade destructive vs conservation", "findings": ["DAT-007","DAT-008","DAT-022","DAT-025","DAT-026"]},
    {"id": "H", "title": "Suite de tests théâtralement verte", "findings": ["TST-003","TST-004","TST-005","TST-006","TST-007","TST-009","TST-010","TST-013","TST-014","TST-015","TST-017","TST-019"]},
    {"id": "I", "title": "Frontend sans couche données partagée", "findings": ["PER-017","PER-018","PER-019","PER-020","PER-021","PER-028","OBS-016"]},
    {"id": "J", "title": "Upload/URL fields = sinks", "findings": ["SEC-009","SEC-010","SEC-011","SEC-015","SEC-016","SEC-017","SEC-018","SEC-024"]},
    {"id": "K", "title": "Auth defense-in-depth", "findings": ["SEC-004","SEC-005","SEC-006","SEC-007","SEC-013","SEC-014","SEC-019","SEC-021","SEC-022","SEC-023","OBS-008","OBS-013"]}
  ],
  "findings": "Voir section détaillée ci-dessous par catégorie."
}
```

---

## Findings détaillés par catégorie

> Chaque finding suit le schéma : `{id, severity, category, subcategory, file, line, title, description, root_cause, suggested_fix, evidence}`.

### Sécurité (SEC-001 → SEC-030)

Voir le rendu intégral de l'agent dans le transcript de session du 2026-05-24. Les 30 findings couvrent : auth (8), authz (6), input_validation (4), file_upload (4), cors (1), csrf (1), secrets (2), other (4).

**Bloquants (5):**
- SEC-001 : RBAC guard défaut `permissive` (`apps/api/src/rbac/permissions.guard.ts:69`)
- SEC-002 : `PATCH /users/:id` sans scope horizontal (`users.service.ts:342`)
- SEC-003 : `reset-password` admin bypass hiérarchie (`users.controller.ts:378`)
- SEC-004 : `forcePasswordChange` non appliqué (`seed.ts:281`)
- SEC-005 : User enumeration via erreur différentielle (`auth.service.ts:84`)

### Correctness (COR-001 → COR-033)

33 findings, 2 bloquants :
- COR-003 : Jours fériés non soustraits du calcul de congés (`leave-year-window.ts:71`)
- COR-005 : `findValidatorForUser` ignore le lien user→délégation (`leaves.service.ts:579`)

Autres importants : COR-001/002 (hardcoded ADMIN), COR-004 (cancel → REJECTED confond les sémantiques), COR-007/012/013 (TZ drift), COR-008 (approve sans re-validation solde), COR-009 (double-approve race), COR-010 (overlap ignore CANCELLATION_REQUESTED), COR-011 (findAll mixed return shape), COR-019 (subtask reorder race), COR-024 (bulk import hors tx), COR-030 (owner cancel APPROVED sans manager).

### Data integrity (DAT-001 → DAT-030)

30 findings, 5 bloquants :
- DAT-001 : Approve leave + audit hors transaction (`leaves.service.ts:1454`)
- DAT-002 : AuditService logger-only (`audit.service.ts:19`)
- DAT-003 : Pas de CHECK `endDate ≥ startDate` (`schema.prisma:575`)
- DAT-004 : Pas de CHECK sur balances/progress (`schema.prisma:646`)
- DAT-005 : `Float` au lieu de `Decimal` pour jours/heures (`schema.prisma:411`)

Autres notables : DAT-007/008/022 (cascades destructives), DAT-009 (audit non-immutable), DAT-010/011 (index manquants), DAT-019 (migration RBAC V4 sans transaction explicite), DAT-020 (backups en clair, non-rotés), DAT-023 (pas d'EXCLUDE GIST sur Leave overlap).

### Performance (PER-001 → PER-030)

30 findings, 4 bloquants :
- PER-001 : N+1 analytics 36+ queries par /analytics (`analytics.service.ts:145`)
- PER-002 : N+1 leave balance 2N queries par user (`leaves.service.ts:2046`)
- PER-003 : Snapshot cron N+1 (`projects.service.ts:983`)
- PER-007 : Planning overview multiplie subqueries unbounded (`planning.service.ts:66`)
- PER-010 : Modèle `Leave` zéro index (`schema.prisma:569`)

Autres : PER-014 (cache stampede sur permissions), PER-019 (TanStack Query sur 3 composants), PER-027 (analytics payload unbounded — régression dateRange déjà connue).

### Observability (OBS-001 → OBS-025)

25 findings, 6 bloquants :
- OBS-001 : Audit log stdout-only (`audit.service.ts:16`)
- OBS-002 : Append-only par convention (`audit-persistence.service.ts:25`)
- OBS-003 : Approve leave audit sans before/after ni snapshot rôle (`leaves.service.ts:1486`)
- OBS-004 : Role changes jamais audités (`users.service.ts:432`)
- OBS-005 : RBAC template mutations jamais audités (`rbac/roles.service.ts:65`)
- OBS-006 : Document downloads non logués (`documents.controller.ts:53`)
- OBS-012 : Deploy workflow fake (`.github/workflows/deploy.yml:70`)

### Tests (TST-001 → TST-025)

25 findings, 8 bloquants :
- TST-001 : Permission matrix 35/91 (`e2e/fixtures/permission-matrix.ts:1`)
- TST-002 : 3 modules sans spec (leave-types, personal-todos, settings)
- TST-003 : Security E2E telework entièrement skippé (`e2e/tests/security/telework-ownership.spec.ts:17`)
- TST-004 : Lifecycle E2E assertion tautologique (`leave-lifecycle.spec.ts:180`)
- TST-005 : `leaves.spec.ts` zéro négatif zéro balance
- TST-006 : 8 it.skip dans tasks page test (TODO jamais reprises)
- TST-007 : 18 `test.skip(!id, …)` sur IDOR (vert quand setup échoue)
- TST-008 : Comments service 100% happy-path

---

## Annexe — payloads JSON bruts par agent

Les 173 findings complets (avec `id`, `severity`, `category`, `subcategory`, `file`, `line`, `title`, `description`, `root_cause`, `suggested_fix`, `evidence`) sont dans :

```
docs/security/2026-05-24-review-payloads/
├── 01-security.json       (30 findings, 5 blocking)
├── 02-correctness.json    (33 findings, 2 blocking)
├── 03-data-integrity.json (30 findings, 5 blocking)
├── 04-performance.json    (30 findings, 4 blocking)
├── 05-observability.json  (25 findings, 6 blocking)
└── 06-tests.json          (25 findings, 8 blocking)
```

Concaténation rapide : `jq -s 'add' docs/security/2026-05-24-review-payloads/*.json > all-findings.json`

---

## Prochaines étapes recommandées

1. **Stop the bleed** : SEC-001 (guard enforce), SEC-002/003 (scope users), DAT-001 (tx audit), DAT-005 (Decimal migration plan), COR-003 (holidays in leave calc).
2. **Audit Cour des Comptes ready** : Cluster A complet — unification AuditService, trigger immutabilité, snapshot rôle/template, request-id propagation, retention policy.
3. **Defense in depth schema** : Cluster F — CHECK constraints, EXCLUDE GIST sur Leave, drop `leaves.type` legacy, indexes manquants (DAT-010/011, PER-010..013).
4. **RBAC complétude** : régénérer la matrice E2E depuis `grep @RequirePermissions`, supprimer hardcoded ADMIN, intégrer scope dans users/leaves reads.
5. **Tests sérieux** : remplacer skip-on-failure par assertions, ajouter négatifs systématiques, ajouter spec d'intégration Postgres pour tx serializable, supprimer E2E legacy.
6. **Auth hardening (3-5 jours)** : `nbf` par user, `trustProxy`, `__Host-` cookie, fail-closed blacklist write, password policy unifiée.
7. **Observability baseline** : Sentry, métriques Prometheus, request-id, Pino structured + redact étendu, retention archival pipeline.
