# Log d'exécution — Dette technique + Gantt unification

**Démarrage** : 2026-04-24
**Exécuteur** : Claude Code (Opus 4.7, orchestrateur)
**SHA baseline** : `c3601bd4f987ea7fd61265d0ec22ec8ba57c698c`
**Branche de base** : `master`
**Contraintes** :
- 1 branche par chantier, PRs non mergées
- Commits conventionnels atomiques, file-by-file staging
- Scope local + GitHub, pas de VPS
- Gate d'un chantier doit passer avant de démarrer le suivant

---

## Wave 0 — Baseline check + décisions pré-démarrage

**Exécuté** : 2026-04-24

### Résultats baseline

| Check | Résultat |
|---|---|
| `git rev-parse HEAD` | `c3601bd` ✅ |
| `git status` | Dette préexistante `backlog/rbac-refactor/` (D files) + `.claude/settings.local.json` modifié, working tree documenté |
| `pnpm run build` | ✅ FULL TURBO cached (advisor flag : cached ≠ executed) |
| `pnpm run test` | ✅ FULL TURBO cached (idem) |

### Advisor verdict

- **C1 (seed cleanup)** : GO. Risque `docker compose down -v` qui wipe DB — faire pg_dump avant. Scope ambigu (RBAC-only vs full rewrite) → RBAC-only par défaut.
- **C2 (Playwright chromium)** : GO. Diagnostic probable : `testMatch` regex ou `dependencies: ["setup"]` manquantes.
- **C3 (Gantt unification)** : **STOP**. Spec v1.1 et `GAPS-gantt-vs-gabarit.md` **introuvables** dans le repo.
  - Vérifs : `backlog/`, `.superpowers/`, `git log --diff-filter=D`, `git stash list` — aucune trace
  - Advisor : « Don't audit-by-guess. No spec = no C3. » Docs potentiellement dans vault Obsidian (mémoire mentionne `CPAM 92/PILOTAGE/`) ou sur autre machine.

### Décision

- **C1** : démarrage maintenant, branche `chore/seed-cleanup-rbac-v4`, escape si >5 fichiers non-seed
- **C2** : à la suite, branche `fix/playwright-chromium-config`
- **C3** : **suspendu**, remonté à l'utilisateur pour clarification sur la localisation des docs

Ordre de merge suggéré par advisor : PR #3 Clients → C2 → C1 → C3 (lorsque docs disponibles).

---

## Chantier 1 — Seed cleanup (issue #2)

**Branche** : `chore/seed-cleanup-rbac-v4`
**Commit** : `ab87637 chore(seed): remove legacy seedPermissionsAndRoles dead function (#2)`

### Audit

`seedPermissionsAndRoles()` (lignes 14–1466 de `packages/database/prisma/seed.ts`, ~1458 lignes) appelle `prisma.permission`, `prisma.roleConfig`, `prisma.rolePermission` — tables SUPPRIMÉES en V4 par la migration `20260420120000_rbac_v4_drop_legacy`. Dead code total.

Entry point `seed-permissions.ts` (script `db:seed:permissions`) n'importait que cette fonction morte → également dead.

### Cleanup appliqué

| Fichier | Changement |
|---|---|
| `packages/database/prisma/seed.ts` | Suppression fonction `seedPermissionsAndRoles` (lignes 9–1466) + appel dans `main()` + 3 lignes de commentaire d'appel |
| `packages/database/prisma/seed-permissions.ts` | Supprimé (dead entry point) |
| `packages/database/package.json` | Script `db:seed:permissions` retiré |

Total : 3 fichiers seed (0 non-seed), 1489 lignes supprimées, 0 ajoutées.

### Out of scope (follow-ups identifiés, non fixés)

Détectés lors de l'audit mais hors périmètre RBAC-only du chantier C1 :

1. **`seedSystemRoleTemplates` wrong accessor** : utilise `prisma.roleEntity` alors que le modèle Prisma s'appelle `Role` (accessor `prisma.role`). Erreurs TS : lignes 1520, 1525, 1532 (pré-cleanup ; désormais décalées).
2. **User upserts dans `main()`** : ~25 occurrences de `role: "ADMIN"` / `"MANAGER"` / etc. où la relation attend `roleId` ou `{ connect: { code: "ADMIN" } }`. Erreurs TS : lignes 1597, 1691, 1706 etc.
3. **Frontend dead** : `apps/web/src/services/role-management.service.ts:95` expose `seedPermissionsAndRoles()` qui POST vers `/role-management/seed` — endpoint inexistant côté API. Méthode non appelée depuis l'UI.

**Note** : Les points 1+2 empêchent actuellement `pnpm db:seed` de tourner (erreurs TS) — dette pré-existante, non régressée par ce PR.

### Gate C1

| Check | Résultat |
|---|---|
| `pnpm run build --force` | ✅ 3 tasks successful, 18.6s, 0 cached |
| `pnpm run test` | ✅ 48 test files / 1087 tests passed côté API (run avant commit) |
| Fichiers touchés | 3 (tous seed) — escape threshold (>5 non-seed) respecté |
| Référence morte restante | 0 (`grep "seedPermissionsAndRoles"` sans résultat) |

**Statut** : `C1 PASS`. Branche prête à PR. **PR #7** ouvert : https://github.com/ElegAlex/Orchestr-A/pull/7

---

## Chantier 2 — Fix Playwright [chromium] config

**Branche** : `fix/playwright-chromium-config`
**Commit** : `6f1bacb fix(e2e): repair [chromium] testMatch to detect root e2e specs`

### Diagnostic

Regex `/^[^/\\]+\.spec\.[jt]s$/` du projet `[chromium]` détecte **0 test**. Cause : Playwright applique `testMatch` sur des chemins **absolus** (commençant par `/`), donc `[^/\\]+` ancré à `^` ne matche jamais le premier caractère (qui est `/`).

Vérif avant fix : `npx playwright test --project=chromium --list` → `Total: 0 tests in 0 files`.

Vérif globale avant fix : total 1953 tests (7 specs racine silencieusement ignorés).

### Fix appliqué

```diff
-testMatch: /^[^/\\]+\.spec\.[jt]s$/,
+testMatch: /[/\\]e2e[/\\][^/\\]+\.spec\.[jt]s$/,
```

- Ancré sur le répertoire `e2e/` littéral
- `[^/\\]+` sur le segment filename empêche toute fuite depuis `e2e/tests/**`

### Specs récupérés (7 fichiers, 45 tests)

- `e2e/auth.spec.ts`
- `e2e/full-workflow.spec.ts`
- `e2e/leaves.spec.ts`
- `e2e/permissions.spec.ts`
- `e2e/planning.spec.ts`
- `e2e/projects.spec.ts`
- `e2e/tasks.spec.ts`

### Gate C2

| Check | Résultat |
|---|---|
| `npx playwright test --project=chromium --list` | ✅ 45 tests détectés (vs 0) |
| `npx playwright test --list` (total) | ✅ 1998 tests (vs 1953) |
| Fuite de specs depuis `e2e/tests/**` vers chromium | ✅ Aucune (vérifié par énumération : 45 entries = 7 fichiers racine exactement) |
| `auth.setup.ts` non dans chromium | ✅ (extension `.setup.ts`, pas `.spec.ts`) |

**Statut** : `C2 PASS`. Branche prête à PR. **PR #8** ouvert : https://github.com/ElegAlex/Orchestr-A/pull/8

**Note** : Les 45 tests récupérés datent d'avant le pattern auth-fixture. Ils se loguent via UI (pas de `dependencies: ["setup"]` requis). Certains peuvent être flaky ou périmés — triage manuel recommandé après merge (hors scope C2).

Les 24 futurs tests Clients (PR #3 non-mergée) seront automatiquement détectés après merge de PR #3, sans nouvelle intervention sur la config.

---

## Chantier 3 — Gantt unification

**Statut** : **BLOQUÉ**

### Blocker

- Spec v1.1 référencée par le prompt utilisateur n'existe pas dans le repo
- `GAPS-gantt-vs-gabarit.md` n'existe pas non plus

Vérifications exhaustives (toutes négatives) :
- `find backlog/ .superpowers/ docs/ -iname "*gantt*"` → zéro fichier de spec
- `git log --all --diff-filter=D -- "**gantt**"` → aucun fichier supprimé récupérable
- `git stash list` → aucun stash contenant ces docs
- Les fichiers `audit-gantt.md` et `audit-legend-v2.md` sont **deleted** dans le working tree (staging D) — pré-existant, pas de contenu récupéré

### Décision

Non démarré. Nécessite clarification utilisateur :
1. Où se trouvent les docs (vault Obsidian `CPAM 92/PILOTAGE/` ? machine séparée ?)
2. Ou abandon du chantier (le Gantt actuel tient-il la route ?)

Advisor verdict : « Don't audit-by-guess. No spec = no C3. »

---

