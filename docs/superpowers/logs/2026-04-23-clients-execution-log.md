# Log d'exécution — Module Clients V1

**Démarrage** : 2026-04-23
**Exécuteur** : Claude Code (Opus 4.7, orchestrateur)
**Spec** : `docs/superpowers/specs/2026-04-23-clients-module-design.md`
**Audit Phase 0** : `docs/superpowers/audits/2026-04-23-clients-audit.md`
**Ratifications Phase 0** (déduites du prompt d'exécution) :
- R1 = A (pas de computed flags, aligné sur third-parties)
- R2 = B (§11 du spec remplacé + W1.5 nettoyage seedPermissionsAndRoles)
- R3 = A (strings littérales FR, pas de namespace `clients.json`)
- R4 = A (🏛️ dans section Administration)

---

## Wave 0.5 — Baseline check

**Exécuté** : 2026-04-23
**SHA baseline master** : `3dd299ec2ec69d5b569e4bb5a424d2f5bf4a58a5`

### Résultats

| Check | Résultat |
|---|---|
| `git rev-parse HEAD` | `3dd299e` ✅ |
| `git status` | 30+ fichiers `D` dans `backlog/rbac-refactor/` (dette préexistante hors scope) + `.claude/settings.local.json` modifié + 2 untracked `.claude/*` — working tree documenté |
| `docker ps` (postgres+redis) | ✅ postgres-1 + redis-1 healthy (`localhost:5433`) |
| `pnpm run build` | ✅ Vert, 16.6s, 3 tasks successful |
| `pnpm --filter database exec prisma migrate status` | ✅ 29 migrations, DB up-to-date, aucune pending |
| `pnpm run test` | ❌ **5 suites failed, 38 tests failed / 528 total** côté `apps/web` |

### Détail des suites cassées

```
FAIL apps/web/src/services/__tests__/milestones.service.test.ts
FAIL apps/web/src/services/__tests__/projects.service.test.ts        ⚠️ sur chemin W2-B
FAIL apps/web/app/[locale]/users/__tests__/page.test.tsx
FAIL apps/web/app/[locale]/tasks/__tests__/page.test.tsx
FAIL apps/web/src/hooks/__tests__/usePlanningData.test.ts
```

### Cause racine identifiée

Dernier commit touchant ces fichiers : **`88eb9fe refactor(web): V4 drop legacy Role enum, migrate all consumers to user.role object`**.

Diagnostic sur `projects.service.test.ts` (échantillon) :

```
Tests:       5 failed, 8 passed, 13 total
- Expected  - 0
+ Received  + 1

    "loggedHours": 50,
    "membersCount": 5,
    "milestonesCount": 3,
    "progress": 50,
    "remainingHours": 50,
+   "thirdPartyLoggedHours": 0,
    "totalHours": 100,
```

→ Le service a été enrichi d'un champ `thirdPartyLoggedHours`, les tests n'ont pas été mis à jour. Cas typique de dette de test post-refactor V4.

### Décision : STOP

Condition d'arrêt du prompt d'exécution utilisateur :

> « Si un de ces checks échoue : **stop, log l'état, refuser de commencer W1.** On ne construit pas sur une fondation bancale. »

**Wave 1 n'est pas lancée.** L'exécution autonome est suspendue pour arbitrage utilisateur.

Risque spécifique : `projects.service.test.ts` est sur le chemin direct du module Clients (W2-B ajoute le filtre `clients` et l'enrichissement `clients: {id, name}[]`). Si je pars sur baseline rouge sur ce fichier précis, je ne pourrai pas distinguer **mes** régressions des pré-existantes.

### Options d'arbitrage remontées à Alexandre

1. **Fix préalable par Alexandre** (ou session dédiée) : les 5 suites sont triées et ré-alignées sur V4 avant relance W1. Propre mais nécessite un aller-retour.
2. **Baseline rouge documentée** : je relance W1, mais mes gates « tests verts » sont remplacés par « pas de nouvelle suite rouge vs baseline du 2026-04-23 » et je fournis un diff de suites passées/failed à chaque Wave.
3. **Fix des 5 suites en Wave 0.7** avant W1, par moi, sur master directement (commits distincts du module Clients). Ça rallonge la timeline mais part d'une base saine.

**Statut actuel** : `BLOCKED: baseline rouge préexistante — arbitrage utilisateur requis`.

---
