# Log d'exécution — Fix CI debt + merge PR (Gantt: chantier déjà livré)

**Démarrage** : 2026-04-24
**SHA baseline master** : `91e2e77`
**PRs en attente** : #3 (Clients), #7 (Seed cleanup), #8 (Playwright fix)

---

## Partie 0 — Correction : Gantt déjà livré

**Statut** : `ABANDONNÉ — chantier déjà fait`

Avant de démarrer la session, vérification explicite commandée par l'utilisateur a révélé que le chantier « Gantt unification » est **déjà commité sur master depuis le 16 avril 2026**.

### Commits Gantt existants

| SHA       | Date       | Message                                                                            |
| --------- | ---------- | ---------------------------------------------------------------------------------- |
| `23fcbfc` | 2026-04-16 | feat(gantt): unified custom Gantt component replacing @rsagiev/gantt-task-react-19 |
| `3b9522e` | —          | feat(gantt): complete visual overhaul v2.0 — premium-grade design                  |
| `0c8e302` | —          | feat(gantt): align Gantt visuals with reference design — 12 gaps addressed         |
| `e6b0634` | —          | fix(gantt): traduire l'interface Gantt en français                                 |
| `9d92072` | —          | feat(gantt): ajouter navigation Début projet et Tout voir                          |
| `9b7c4d3` | —          | feat(gantt): trier le portfolio par date de fin croissante                         |
| `66cb1f7` | —          | fix(gantt): en-tête timeline aligné en scroll horizontal et vertical               |
| `920f1c1` | —          | fix(gantt): borner la hauteur du Gantt pour concilier sticky header et sync scroll |

Commit `23fcbfc` body : _« Single <Gantt> component parameterized by scope (portfolio | project). 19 nouveaux fichiers dans apps/web/src/components/gantt/. 118 tests unitaires à 100% coverage. SVG dependency arrows. Portfolio adapter 903→77 lignes. Lib tierce @rsagiev/gantt-task-react-19 supprimée. »_

Deux sessions précédentes avaient conclu à tort « BLOCKED — spec v1.1 introuvable » en cherchant des documents alors que le code livré racontait toute l'histoire. Feedback mémoire ajouté (`feedback_check_code_before_declaring_blocked.md`) : **mémoire projet = état passé, git log = état actuel**.

→ Partie 3 du prompt (recovery Gantt + scénarios A/B/C) est **entièrement caduque**. Non exécutée.

---

## Partie 1 — Fix CI debt sur master

**Branche** : `chore/ci-debt-fix`
**Stratégie** : 2 agents parallèles (Sonnet), 1 PR unique.

### Diagnostic baseline (master `91e2e77`)

| Check                        | Baseline  | Requis   | Gap     |
| ---------------------------- | --------- | -------- | ------- |
| `pnpm --filter web run lint` | 13 errors | 0 errors | -13     |
| `test:cov` functions         | 71.81%    | ≥80%     | -8.19pp |
| `test:cov` branches          | 60.80%    | ≥65%     | -4.20pp |

Cible utilisateur (safety margin) : 82% functions / 67% branches.

### Agent A — Lint fixes (13 errors → 0)

4 fichiers, 4 commits atomiques :

| SHA       | Fichier                   | Fix                                                                         |
| --------- | ------------------------- | --------------------------------------------------------------------------- |
| `63eba89` | `UserAvatar.tsx`          | `useRef` prev-prop → `useState` prev-prop pattern                           |
| `a53c648` | `EmojiPicker.tsx`         | `useEffect` reset-on-close → `useState prevIsOpen` prev-prop guard          |
| `9c8faa0` | `MyTasksSection.tsx`      | `useState+useEffect` localStorage → `useSyncExternalStore`                  |
| `869e931` | `ProjectsDetailTable.tsx` | `SortHeader` inline component → module-scope + props (9 call sites updated) |

Résultat : 0 errors, 22 warnings (pré-existants acceptés par spec), 514 tests web verts, 0 `eslint-disable`.

### Agent B — Coverage API

6 commits atomiques :

| SHA       | Scope                                                              |
| --------- | ------------------------------------------------------------------ |
| `a3ee079` | holidays.service + prisma.service (full suites)                    |
| `034150f` | users.service, users.controller, ownership.service, jwt-auth.guard |
| `bc70c96` | planning-export.service (exportIcs branches + importIcs)           |
| `68fb7e4` | events.service, audit.service, current-user decorator              |
| `d751161` | epics.service membership + school-vacations importFromOpenData     |
| `ffb16b9` | roles.service + milestones.controller                              |

Résultat post-Agent B : **functions 80.08%** (+8.27pp), **branches 67.09%** (+6.29pp). CI passe, 1224 tests verts, `test:cov` exit 0.

⚠️ Margin functions 0.08pp seulement (vs 82% cible). Agent B2 dispatché sur `leaves.service` pour atteindre ≥82%.

### Agent B2 — Safety margin (en cours)

**Scope** : `leaves.service.spec.ts` ajoutant tests pour lignes 2108-2585 (bulk leave management).
**Budget** : max 2 commits / 45 min.
**Cible** : functions ≥82% avec marge, branches non-régressées.

### Gate Partie 1 (en attente Agent B2)

À valider avant PR :

- [ ] `pnpm --filter web run lint` : 0 errors
- [x] `pnpm --filter api run test:cov` : thresholds met (80.08%/67.09%)
- [ ] `pnpm run build` : vert
- [ ] `pnpm run test` : vert
- [ ] Margin functions ≥82% (en cours B2)

---

## Partie 2 — Merge des 3 PRs (en attente)

Après merge de `chore/ci-debt-fix` sur master vert :

Ordre imposé : **#3 → #8 → #7**

Pour chaque PR :

1. `gh pr checkout {N}` → `git rebase master` → `git push --force-with-lease`
2. `gh pr checks {N} --watch` → attendre green
3. `gh pr merge {N} --squash --delete-branch`
4. `git checkout master && git pull` → vérifier build/test local vert
5. Passer à la PR suivante

---

## Partie 3 — CADUQUE (Gantt déjà livré)

Voir Partie 0.
