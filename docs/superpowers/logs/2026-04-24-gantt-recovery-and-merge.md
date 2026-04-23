# Log d'exécution — Gantt recovery + merge PR en attente

**Démarrage** : 2026-04-24 (autonome complet)
**SHA baseline master** : `91106f3b9b3098606992a7837bb425869415de0c`
**PR en attente** : #3 (Clients), #7 (Seed cleanup), #8 (Playwright fix)

---

## Statut final

**`BLOCKED — master CI rouge en pré-existant, blocage en cascade sur les 3 PRs`**

---

## Partie 1 — Merge des 3 PRs : ÉCHEC au pré-check

### Résultat `gh pr checks` (tous PRs)

Les 3 PRs (#3, #7, #8) présentent **exactement le même pattern d'échec CI** :

| Check | PR #3 | PR #7 | PR #8 |
|---|---|---|---|
| Backend Tests (API) | ❌ fail | ❌ fail | ❌ fail |
| Lint & Format | ❌ fail | ❌ fail | ❌ fail |
| Frontend Tests (Web) | ✅ pass | ✅ pass | ✅ pass |
| Build Offline / Validation / Docker | — skipping (dépendent des précédents) |

Les 3 PRs sont `mergeable: MERGEABLE` mais `mergeStateStatus: UNSTABLE`.

### Diagnostic des rouges — **pré-existants sur master**

#### 1. Backend Tests (API) — coverage thresholds non atteints

Extrait log CI (PR #3, run `24828766151`) :

```
✓ src/tasks/tasks.service.spec.ts (102 tests)  189ms
✓ src/leaves/leaves.service.spec.ts (94 tests)  189ms
... [tous les ✓ passent]
ERROR: Coverage for functions (72.88%) does not meet global threshold (80%)
ERROR: Coverage for branches (61.46%) does not meet global threshold (65%)
ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL  api@2.0.0 test:cov: `vitest run --coverage`
```

**Aucun test ne fail**. Le job échoue uniquement sur les seuils de coverage :
- Functions : 72.88% vs requis 80% (-7.12pp)
- Branches : 61.46% vs requis 65% (-3.54pp)

#### 2. Lint & Format — 13 erreurs ESLint react-hooks

Erreurs locales reproduites sur master `91106f3` :

```
/apps/web/src/components/dashboard/MyTasksSection.tsx:64:30
  error  Error: Calling setState synchronously within an effect can trigger cascading renders  react-hooks/set-state-in-effect

/apps/web/app/[locale]/dashboard/page.tsx
  error  Error: Cannot create components during render  (x ~10 occurrences)
  error  Error: Calling setState synchronously within an effect ...
  error  Error: Cannot access refs during render  (x 2)

✖ 35 problems (13 errors, 22 warnings)
```

### Preuve : aucune PR #3/7/8 n'a introduit ces erreurs

Dernier commit touchant les fichiers lint-erreurs (ex: `MyTasksSection.tsx`, `app/[locale]/dashboard/page.tsx`) :

```
b0ec76f fix(dashboard): saisie inline + bouton modal aussi sur tâches non déclarées
```

Commits postérieurs à `b0ec76f` jusqu'à HEAD :

```
91106f3 docs(superpowers): add post-PR smoke-run findings for C2
21ae685 docs(superpowers): log C1 seed cleanup + C2 Playwright fix + C3 blocker
c3601bd docs(clients): spec §15 ratifications + §16 plan révisé + log W0.7 pass
cb2cdca test(fix): update usePlanningData.test ...
5550b62 test(fix): update tasks/page.test ...
b0b243e test(fix): update users/page.test ...
0c2f5d7 test(fix): update projects.service.test ...
45078f4 test(fix): update milestones.service.test ...
41eda4e docs(clients): log Wave 0.5 baseline
3dd299e docs(clients): audit Phase 0 du module Clients
```

→ **Aucun de ces commits ne touche les fichiers frontend source fautifs**. Ce sont :
- des docs (superpowers, clients)
- des fix de tests (pas du code de prod)

Les erreurs ESLint react-hooks existent avant le 2026-04-23 07:50 (timestamp du plus récent ancêtre commun `c3601bd`). Elles apparaissent probablement après l'activation d'un preset ESLint plus strict (rules `react-hooks/set-state-in-effect`, `react-hooks/component-in-render`, `react-hooks/refs-in-render` — règles récentes React).

**Les PRs #3, #7, #8 n'introduisent aucune nouvelle erreur lint ni baisse de coverage** : elles héritent l'état rouge de master.

### Décision : stop Partie 1, pas de merge

Condition d'arrêt explicite du prompt utilisateur :

> « Une PR ne peut être mergée (checks rouges, conflits) »

Advisor consulté : confirme stop. « Coverage thresholds et 13 lint errors are not "warnings non bloquants" — they're hard-fail checks by CI design. The fact that they're pre-existing on master doesn't change the letter of the instruction. »

**Pas de `--admin` override, pas de bypass.** Le prompt utilisateur a explicitement prévu cette branche.

### Le deadlock à remonter

Master CI est rouge en baseline → aucune PR ne peut passer CI.

**Options utilisateur** (hors scope de cette session autonome) :

1. **Fix debt dédié** : session séparée pour réparer les 13 erreurs ESLint et remonter la coverage de 7pp (fonctions) + 3.5pp (branches). Puis relance merge.
2. **Override `--admin`** : autoriser explicitement le merge admin sur #3/#7/#8 (leur red est hérité, pas introduit). Nécessite autorisation utilisateur explicite — non pris de façon autonome.
3. **Ajuster seuils / règles** : si la règle `react-hooks/set-state-in-effect` a été ajoutée récemment et que le codebase n'a pas rattrapé, baisser temporairement ou mettre en `warn`. Coverage idem.
4. **Rebase individuel** : chaque PR rebase sur un master déjà assaini. Même flux que option 1.

Recommandation advisor : option 1 (propre, durable), option 2 (rapide mais accumule de la dette).

---

## Partie 2 — Recherche docs Gantt

**Non exécutée.** Per condition d'arrêt global du prompt :

> « Si le gate passe, enchaîner Partie 2. Sinon, stop et log. »

Le gate Partie 1 échoue → Partie 2 non atteinte.

### Note

La recherche Partie 2 (docs Gantt, vault Obsidian, reconstitution) est **indépendante** des PRs et peut être exécutée dans une session séparée si l'utilisateur le ré-autorise. Les scénarios A/B/C du prompt restent valides pour cette session dédiée.

Matériel pré-existant utilisable (non ré-vérifié dans cette session) :
- Session précédente a déjà vérifié `backlog/`, `.superpowers/`, `git log --diff-filter=D`, `git stash list` → **zéro trace**
- Reste non vérifié : vault Obsidian (`~/Documents/Obsidian`, `~/Obsidian`, iCloud macOS, `CPAM*/PILOTAGE`)
- Reste non vérifié : fichiers `audit-gantt.md` / `audit-legend-v2.md` **deleted** dans working tree de master — contenu récupérable via `git show HEAD:audit-gantt.md`

---

## Partie 3 — Non atteinte

Dépend du scénario Partie 2.

---

## Actions prises

| Action | Résultat |
|---|---|
| `git pull` master | ✅ déjà à jour (`91106f3`) |
| `gh repo view` merge methods | ✅ merge/squash/rebase tous autorisés |
| `gh pr checks 3/7/8` | ❌ 2 hard-fails communs (coverage + lint) |
| `gh pr view --json mergeable` | ✅ MERGEABLE mais UNSTABLE |
| Lint local sur master | ✅ reproduit : 13 errors, 22 warnings pré-existants |
| Git blame fichiers fautifs | ✅ dernier commit = `b0ec76f` (avant tous les PRs) |
| Advisor consulté | ✅ confirme stop |
| Merge PR #3 | ⛔ NON EFFECTUÉ (gate rouge) |
| Merge PR #8 | ⛔ NON EFFECTUÉ (gate rouge) |
| Merge PR #7 | ⛔ NON EFFECTUÉ (gate rouge) |
| Partie 2 (recherche Gantt) | ⛔ NON EXÉCUTÉE (dépend gate Partie 1) |
| Partie 3 (Scénario A/B/C) | ⛔ NON EXÉCUTÉE |
| Log d'état | ✅ présent fichier |

---

## Statut

**`BLOCKED — master CI rouge (coverage + lint), pré-existant, blocage en cascade sur PR #3/#7/#8. Partie 2+3 non exécutées car condition d'arrêt global déclenchée. Arbitrage utilisateur requis : fix debt / admin override / ajustement seuils.`**

SHA master inchangé : `91106f3`.
