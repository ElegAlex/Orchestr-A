# ORCHESTRA Audit Remediation — Session Handover (post-Phase-4 Cluster-A closure; Phase 3 + mini-arc LIVE in prod)

## Contexte projet
Repo: /home/alex/Documents/REPO/ORCHESTRA (NestJS + Prisma + Next.js monorepo)
User: Alexandre, DSI CPAM 92. Audit Cour des Comptes window S1 2026.
Communication: French (user). Code/docs en English.
Stack prod: VPS 92.222.35.25 (debian@), Docker Compose, PostgreSQL 18, accès SSH via ~/.ssh/id_ed25519 (clé uniquement, jamais le mot de passe), repo prod à /opt/orchestra. Container DB = postgres service (orchestr-a-postgres-prod), DB=orchestr_a_prod, user=orchestr_a (superuser via peer auth dans le conteneur). Prod runs UTC.

Discipline obligatoire: lire `CLAUDE_SESSION_CONTRACT.md` EN PREMIER. Pattern par task: IN_PROGRESS commit AVANT code → fix commit `[closes X]` → BACKLOG (DONE + Closed_by) + PROGRESS_LOG closeout. Master-only (pas de PR). `scripts/check-backlog-coherence.sh` = gate (DONE ⇒ SHA + `[closes X]` dans le commit).

---

## Current state (master HEAD `60bd546`; coherence script = 57 DONE entries; running checked-set = 56)

**Compte cohérence — convention.** Le script `bash backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh` reporte **57 entries DONE**. Notre compteur interne "checked-set" est à **56** parce que le bundle DAT-003+DAT-004 a été compté comme 1 unité (1 migration, 1 SHA partagé). Le gap de +1 persiste, structurel. Les deux nombres sont corrects sous leurs rubriques respectives. Pour les rapports Cour des Comptes, le compte par task (57) est l'autorité ; pour le suivi de progression, le compte checked-set (56) est la métrique. Depuis le précédent refresh (script 53 / checked-set 52) : +4 closures (COR-038, DOC-001, COR-001, COR-002), chacune +1 sur les deux compteurs.

> **Note gate — bruit pré-existant (TOOL-COH-003, filed 2026-05-28).** Le script affiche actuellement **10 violations `Closed_by`-format** (`Status=DONE but Closed_by is missing/invalid`) sur des entries Phase-3 mini-arc : 8 SHAs wrappés en backticks (DAT-032/033/034/036, COR-034/035, DAT-038, COR-037) + 2 lignes `Closed_by: (none — …)` stale (DAT-035, DAT-037, dont le vrai SHA est plus bas dans un bullet Learnings). **Le gate ne FAIL PAS** — ces tasks sont substantiellement closes avec SHA valides en git ; seul l'extracteur `.split()[0]` du script bute sur le format. Filé comme TOOL-COH-003 (BACKLOG-formatting-only, à cleaner en session séparée — ne PAS corriger ici).

### Phase 3 + completion mini-arc — ✅ 20 TASKS DONE ET LIVE EN PROD (2026-05-28)

**Phase 3 audit-prescribed (10/10 DONE):**

| Task | Closed_by | Nature |
|---|---|---|
| DAT-003 + DAT-004 (bundled) | `62c2fc4` | 7 date CHECKs + 7 numeric CHECKs |
| COR-022 | `760aa58` | TimeEntry single-entry bound + per-(userId,date) daily cap (service-layer) |
| DAT-012 | `c8b618e` | string→enum promotion of 6 columns; AuditLog canonical codes documented |
| DAT-013 | `c0189c1` | HH:MM time-of-day format as DB CHECK on 6 String columns |
| DAT-014 | `f8a5ce9` | `leaves.type` auto-sync trigger; legacy enum column now a read-only FK mirror |
| DAT-016 | `ce8877a` | UNIQUE on `departments.name` + composite UNIQUE on `services(departmentId, name)` |
| DAT-017 | `f6ca325` | CHECK `tasks_parent_requires_project_ck` — epic/milestone requires `projectId` |
| DAT-018 | `fff93ce` | CHECK no-self-loop + BEFORE trigger no-cycle on `task_dependencies` |
| DAT-023 | `c27862a` | `leaves_no_overlap` EXCLUDE USING gist (partial WHERE APPROVED) |

**Phase 3 completion mini-arc (10/10 DONE — 9 work-units across 2 sessions + 1 HALT-and-resume on each design decision):**

| Task | Closed_by | Migration / Code | Nature |
|---|---|---|---|
| DAT-032 + DAT-033 (bundled) | `7af1991` | `20260528120000` | CHECK `subtasks.position >= 0` + CHECK `time_entries.hours BETWEEN 0 AND 24` (dismissal floor preserved) |
| DAT-036 | `ce026d6` | `20260528130000` | UNIQUE `clients.name` — third instance of DAT-016 family |
| DAT-038 | `a99dda5` | `20260528140000` | CHECK `events_parent_no_self_ck` + cycle trigger `events_parent_no_cycle_trg` — DAT-018 analog on self-FK |
| COR-034 | `08d04b1` | code-only | Map P2002 → 409 on Department/Service/Client create+update (race-window past pre-check; widened to Client per DAT-036) |
| COR-035 | `d5ac36a` | code-only | DTO orphan-task 400 — `ProjectRequiredWhenParentedConstraint` on CreateTaskDto |
| COR-037 | `abd6982` | code-only | Map 23P01 → 409 on leaves approve + import (AC#4 N/A verified) |
| DAT-037 | `128393e` | `20260528150000` | Cross-table task↔epic/milestone projectId consistency: task-side BEFORE REJECT + 2 parent-side AFTER CASCADE triggers (Option A, resumed from BLOCKED-DESIGN-DECISION) |
| DAT-034 | `6b17ec9` | code-only | Per-day hours cap extended to third-party declarations (mirror COR-022 on `thirdPartyId` dimension) |
| DAT-035 | `148b713` | `20260528160000` | CHECK `project_members.role` length 1..100 + DTO trim/length + dead-code removal of UPPERCASE `OWNER`/`LEAD` (Option (a)+dead-code, resumed from BLOCKED-DESIGN-DECISION) |

**Doc trail:**
- `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md` — seeded 2026-05-27, finalized 2026-05-28 `43ed9a8`, re-finalized post-mini-arc 2026-05-28 `ebcd9e1`, deploy-execution-log appended `5ec83f7` (master HEAD at the previous refresh; now `60bd546` after the Phase-4 Cluster-A closures).
- Counts in the doc are canonical: **20 tasks / 19 scope rows / 13 migrations / 5 code-only / 18 rollback steps** (the DAT-003+004 bundle = 1 row for 2 tasks; the DAT-032+033 bundle = 1 row for 2 tasks but listed in the doc as 2 rows for narrative reasons → 19 scope rows total).

### DAT-007 (Phase 10) — DONE `0eae219`, pickup hors-phase
Pris hors séquence pendant l'arc audit (FK `Task.projectId` Cascade → Restrict, préserve l'historique). Sert de pattern-mirror direct pour USR-DEL-001. **Le reste de Phase 10 (DAT-008/022/025/026) est TODO** — ne pas y toucher avant les décisions de séquence (voir §Next).

### Phase 4 — RBAC complétude — ✅ OUVERTE, 2/6 DONE (2026-05-28)

Les 2 cleanups pré-Phase-4 (COR-038 + DOC-001) sont vidés. Phase 4 est ouverte ; 2 des 6 tasks sont closes.

| Task | Closed_by | Nature |
|---|---|---|
| **COR-001** | `cb3b5e1` | epics : remplace `if (userRole === 'ADMIN') return;` par `permissions.includes('projects:manage_any')` (miroir littéral `projects.service.ts:77`). PermissionsService injecté ; EpicsModule untouched. `pnpm test` 1692→1694 (+2). |
| **COR-002** | `27c0424` | milestones : même fix verbatim. PermissionsService injecté ; MilestonesModule untouched. `pnpm test` 1694→1697 (+3, dont member-passes regression net-new — pas d'existante côté milestones). |

**⚠️ Convention "cluster" — collision de lettre à désamorcer.** Le champ `Cluster:` du BACKLOG marque **les 6 tasks Phase 4 en `Cluster: B`** (la maille audit d'origine, grossière). Le kickoff Phase-4 a introduit une **sur-grille thématique A/B/C par root-cause** qui ne correspond PAS au champ BACKLOG :
- **Cluster A (thématique) — guard-hardcoding templateKey-only :** COR-001 (`cb3b5e1`) + COR-002 (`27c0424`) → **CLOSED.** Mécanisme uniforme : injection `PermissionsService` + `permissions.includes('projects:manage_any')` miroir littéral `projects.service.ts:77`. Carry-forward : discharge templateKey-only pour epics + milestones.
- **Cluster B (thématique) — horizontal-scope-missing :** COR-028 (leaves ownership) + SEC-030 (users:id scope) → restant.
- **Cluster C (thématique) — test-coverage-gap :** TST-001 (permission matrix completeness) + TST-018 (role-mutation flow witness) → restant.

Le champ `Cluster: B` du BACKLOG/PROGRESS_LOG reste l'autorité de schéma (un greppeur verra COR-001 = `Cluster: B`, PAS "A") ; A/B/C ici est l'overlay de kickoff par root-cause, à ne pas confondre avec la valeur de champ. La lettre "B" est volontairement réutilisée par l'overlay — ne pas lire "Cluster B thématique (horizontal-scope)" comme égal au champ `Cluster: B` (qui tague les 6).

---

## ✅ PROD DEPLOY — Phase 3 + mini-arc DEPLOYÉ (2026-05-28)

| Élément | État prod vérifié |
|---|---|
| **Prod git HEAD (déployé)** | **`ebcd9e1`** (re-finalized deploy doc; mini-arc complete) |
| **Master HEAD (current)** | **`60bd546`** — 15 commits ahead of prod (`ebcd9e1..60bd546`). **Prod has 3 code-only runtime deltas pending deploy:** COR-038 `24c6929` (events parent-cycle → 409 mapping) + COR-001 `cb3b5e1` (epics ADMIN role-code bypass → `projects:manage_any`) + COR-002 `27c0424` (milestones ADMIN role-code bypass → `projects:manage_any`). All guard / error-mapping fixes — **no DB change, no migration** since the 2026-05-28 Phase 3 deploy. The other 12 commits are docs (DOC-001 `006adb7`, deploy-log) + backlog/handover bookkeeping (no runtime effect). |
| **api image (running)** | `sha256:3c264f51b8133b…` (built 2026-05-28 ~12:48 UTC) |
| **Rollback anchor image** | `orchestra-api:pre-phase3-defense-in-depth = 10c69f6fbce8` (pre-deploy build, preserved) |
| **Backup (Gate-1)** | `/opt/orchestra/backups/pre-phase3-batch-deploy-20260528-124439.sql` · **1.5 MB** · pg_dump exit 0 · structurally verified |
| **`_prisma_migrations`** | 43 → **56** rows (+13) |
| **Public health** | `GET https://localhost/api/health` → `{"status":"ok"}` ✅ |
| **V5 row counts vs baseline** | leaves 137 / tasks 321 / project_members 121 / time_entries 15 / clients 7 / events 8 / subtasks 1030 — **UNCHANGED** (no data loss) |
| **DAT-014 backfill** | leaves.type clean: CP 95 / RTT 28 / OTHER 11 / SICK_LEAVE 3 (137 total) — no NULLs |

**Phase 1+2 baseline (pre-mini-arc) — ✅ déployé 2026-05-25 / 2026-05-26.**

> **Correction de l'ancien baseline encodé dans la doc deploy seeded 2026-05-27.** Le doc disait « Expected last applied migration `20260524100100_dat005_convert_float_to_decimal` » (≡ état post-Phase-1). En réalité prod avait déjà Phase 2 (4 migrations) depuis 2026-05-26 alongside TOOL-DEPLOY-001 : `20260525190000_audit_logs_immutability_hash_chain_actor_snapshot`, `20260525200000_dat007_project_fk_restrict_preserve_history`, `20260525210000_obs012_deployments_table`, `20260526120000_dat021_audit_payload_schema_version_gin_index`. Prod git était à `3fd8986` (post-Phase-2). Le baseline stale était inoffensif — Prisma calcule la delta depuis `_prisma_migrations`, pas depuis le doc — mais la confusion est corrigée maintenant. **Gap d'audit-trail Cour des Comptes :** aucune doc `docs/deploy/2026-05-26-phase-2-*` n'a été authored à l'époque. Filé en **DOC-001** (voir §Filings).

---

## 🚨 Operational carry-forwards — NOW LIVE IN PROD (lecture obligatoire pour support / next-picker)

Ces 4 invariants sont actifs sur prod depuis 2026-05-28. Une question support / un comportement « bizarre » côté UI doit être lu à travers ces lentilles AVANT d'être qualifié bug.

1. **DAT-037 silent cascade.** Tout `UPDATE epics.projectId` ou `UPDATE milestones.projectId` réécrit silencieusement le `projectId` de toutes les tasks dépendantes (via les triggers AFTER UPDATE `epics_cascade_projectid_trg` / `milestones_cascade_projectid_trg`). C'est de la cohérence dérivée du système, **intentionnelle, AC#4 N/A** (la projectId de la task n'est pas dans la liste audit-sensitive). Message support si l'utilisateur signale « j'ai déplacé un epic et toutes mes tasks ont suivi » : « ce n'est pas un bug, c'est le comportement attendu — l'epic et ses tasks restent dans le même projet par construction ». **Edge case impossible aujourd'hui** : une task avec deux parents (epicId + milestoneId) dans des projets DIFFÉRENTS bloquerait le cascade (le BEFORE rejetterait sur l'autre côté). Le pre-deploy topology scan a confirmé 0 cas en prod (435 tasks bi-parentées, toutes même-projet).

2. **DAT-038 — trigger SEUL en première ligne (pas de service-layer guard) — COR-038 FIXED ON MASTER, PAS ENCORE EN PROD.** Contrairement à DAT-018 (qui est un DB floor au-dessus de `tasks.service.ts checkCircularDependency` retournant 400), `events.service.ts` n'a PAS d'équivalent. Un path API qui construit un `parentEventId` cyclique tombe sur le trigger P0001 → fuite en HTTP 500 brut. **COR-038 est CLOS sur master (`24c6929`)** — `events.service.ts` mappe désormais P0001/23514 en `ConflictException(409)`. **MAIS la prod tourne toujours `ebcd9e1`** (pré-COR-038) : **aujourd'hui prod renvoie encore un 500 brut** sur ce path cyclique. Lecture support en attendant le prochain deploy : 500 attendu sur `parentEventId` cyclique en prod, cause-racine documentée, fix prêt en attente de ship (un des 3 deltas runtime undeployed). Update opérationnel (500 → 409) effectif au prochain deploy Phase-4.

3. **DAT-033 + COR-022 TOCTOU residual — toujours ouvert.** Le cap quotidien d'heures (par-`userId` ET par-`thirdPartyId` après DAT-034) est un read-then-write non-transactionnel : deux requêtes concurrentes même-jour peuvent toutes deux passer le check et toutes deux commit, dépassant 24h. Le per-row CHECK DAT-033 est structurellement incapable de fermer ça (CHECK per-row, pas cross-row aggregate). Fermeture sous concurrence nécessiterait une transaction sérialisable ou un trigger d'agrégat — décision séparée, plus lourde. Pour l'instant : la contrainte tient sous trafic normal ; pas de cas signalé en prod.

4. **DAT-035 — whitespace-only role admis au DB par design.** Le CHECK `project_members_role_length_ck` est `char_length(role) BETWEEN 1 AND 100`. Un role `'   '` (whitespace pur) passe le CHECK. Le DTO `AddMemberDto` / `UpdateMemberDto` trim au boundary API via `@Transform`, donc aucun path applicatif légitime ne produit whitespace-only. Un futur reviewer qui voudrait durcir le CHECK à `length(btrim(role)) >= 1` doit savoir que c'est un design contract intentionnel — le test d'intégration `dat035-…int.spec.ts` a un test dédié qui pin ça pour qu'un changement non-coordonné échoue.

### ✅ Resolved carry-forwards (Phase-4 Cluster-A — guard-hardcoding)

Le principe forward-looking porté par la prep Phase-4 — **CODE résout les permissions via `templateKey`, JAMAIS de role-code hardcodé** ([[feedback_no_hardcode_hotfix]] / [[project_rbac_seed_silent_skip]]) — a été **discharge sur 2 défauts** :
- **epics (COR-001 `cb3b5e1`)** et **milestones (COR-002 `27c0424`)** : le `if (userRole === 'ADMIN') return;` dans `assertProjectMembership` est remplacé par `permissions.includes('projects:manage_any')`. Un rôle institutionnel bound au template ADMIN (dont le `role.code` n'est PAS le littéral `'ADMIN'`) passe désormais le bypass.
- **Le principe DEMEURE forward-looking pour le reste de Phase 4** : toute task scope-side (COR-028, SEC-030) doit résoudre l'autorisation via permissions, jamais via role-code, et toute task test-coverage (TST-001, TST-018) doit vérifier le path permission-based, pas une présomption role-code. **Ne PAS re-découvrir le pattern à la prochaine session** — il est établi, miroir `projects.service.ts:77`.

---

## Filings — 14 total (10 Phase-3-arc + 1 Phase-1-tooling + 2 deploy-surfaced 2026-05-28 + 1 session-derived TOOL-COH-003) — 12 DONE + 2 TODO

Toutes closes sauf 2 TODO : **TOOL-DBSYNC-001** (Phase 1, dette structurelle) et **TOOL-COH-003** (Phase 1, bruit de gate, filed 2026-05-28). Les 2 deploy-surfaced filings (COR-038 + DOC-001) sont désormais closes.

> *Correction off-by-one : le précédent refresh annonçait "14 total / 11 Phase-3-arc" sur une table de 13 lignes (10 Phase-3-arc, pas 11). Recompté ici ligne-par-ligne — 14 lignes après ajout de TOOL-COH-003.*

| ID | Phase | Status | Origine | Closed_by |
|---|---|---|---|---|
| **DAT-032** | 3 | DONE | DAT-004 closeout (`62c2fc4`) | `7af1991` (bundled w/ DAT-033) |
| **DAT-033** | 3 | DONE | COR-022 closeout (`760aa58`) | `7af1991` (bundled w/ DAT-032) |
| **DAT-034** | 3 | DONE | COR-022 closeout (`760aa58`) | `6b17ec9` |
| **DAT-035** | 3 | DONE | DAT-012 pre-flight (`c8b618e`) | `148b713` (Option (a)+dead-code, after HALT-for-decision) |
| **DAT-036** | 3 | DONE | DAT-016 closeout (`ce8877a`) | `ce026d6` |
| **COR-034** | 3 | DONE | DAT-016 closeout (`ce8877a`) — widened to include Client per DAT-036 | `08d04b1` |
| **DAT-037** | 3 | DONE | DAT-017 closeout (`f6ca325`) | `128393e` (Option A REJECT+CASCADE, after BLOCKED-DESIGN-DECISION) |
| **COR-035** | 3 | DONE | DAT-017 closeout (`f6ca325`) | `d5ac36a` |
| **DAT-038** | 3 | DONE | DAT-018 closeout (`fff93ce`) | `a99dda5` |
| **COR-037** | 3 | DONE | DAT-023 closeout (`c27862a`) | `abd6982` |
| **TOOL-DBSYNC-001** | 1 | TODO | DAT-003/004 bundle (`62c2fc4`) | — (workaround used throughout; structural fix not yet picked) |
| **COR-038** | 3 | DONE | Phase 3 prod deploy Gate-5 reminder | `24c6929` (event cycle P0001/23514 → 409; service-layer pre-check deferred) |
| **DOC-001** | 2 | DONE | Phase 3 prod deploy Gate-0 finding | `006adb7` (Phase 2 deploy doc backfill, retroactive) |
| **TOOL-COH-003** | 1 | **TODO (2026-05-28)** | COR-038/COR-001/COR-002 closeouts | — *10 pre-existing `Closed_by`-format gate violations (8 backtick-wrapped SHAs + 2 stale `(none)` lines); BACKLOG-formatting-only cleanup* |

### Deliberately NOT filed (don't-file-phantoms discipline — record as anti-evidence)
- **COR-036** (would have been "trigger→500 leak on TaskDependency cycle") — `tasks.service.ts checkCircularDependency` returns 400 *before* any DB write, so the DAT-018 trigger only fires on direct-SQL bypass. No app-layer mapping needed. (See PROGRESS_LOG 2026-05-27 DAT-018 closeout.) **Note: COR-038 IS filed for the events analog precisely because `events.service.ts` has NO service-layer cycle guard — the symmetry breaks here.**
- **DAT-039** (would have been "widen DAT-023 partial WHERE for half-day") — pre-flight showed `checkOverlap` ignores `halfDay`, so morning+afternoon-same-day is *already* a conflict in product semantics, not a feature. The audit's literal `'[]'` bounds stand.

---

## Defense-in-depth sur `audit_logs` — 5 couches (inchangé, vérifié en prod 2026-05-28)
1. **Immutability trigger** `audit_logs_no_update_delete` — `d6299cc`. UPDATE/DELETE → RAISE (SQLSTATE 23514).
2. **Hash chain** (`computeRowHash` + `prevHash`) — `d6299cc`. Recompute via `audit/recompute-chain.ts` (jamais ré-implémenter le hash).
3. **Actor snapshot** — `d6299cc`.
4. **Zod payload validation** `.strict()` + `schemaVersion` + GIN index — DAT-021 `33f7a9c`. Registre exhaustif ; rejet au INSERT avant hash.
5. **DB role REVOKE** — TOOL-DEPLOY-001 `8c37e1d`. `app_user` perd UPDATE/DELETE/TRUNCATE sur `audit_logs` (SQLSTATE 42501, en amont du trigger).

---

## Patterns infra récurrents établis (réutilisables Phase 4+)
- **Coherence gate** : multi-segment-aware (`[A-Z]+(?:-[A-Z]+)*-\d+`) + **anchor-commit pattern** pour closures rétroactives (empty commit portant `[closes <id>]`). Toute édition de `Closed_by` DOIT lire le script avant de prescrire un SHA.
- **Real-DB integration harness** (TST-DB-001) : DB éphémère + `prisma migrate deploy` + drop teardown. Cible `pnpm test:integration`, fichiers `*.int.spec.ts`. **Chemin de witness obligatoire pour CHECK/trigger/EXCLUDE.** Le mini-arc a fait passer la suite intégration à **85 tests** sur 17 files (Phase 3 audit-prescribed + 5 nouveaux witnesses mini-arc : DAT-032/033 6 tests, DAT-036 3 tests, DAT-038 7 tests, DAT-037 7 tests, DAT-035 6 tests).
- **Retroactive closure mechanism** : anchor commit `--allow-empty` nommant le SHA upstream.
- **Defense-in-depth** : invariant en code (DTO/Zod) PLUS au niveau DB.
- **Throwaway-DB witness pattern** : DB jetable créée+droppée dans la session.
- **Bundle discipline** : tasks de même famille (même file, même mécanisme, même witness path) bundle dans une migration unique + dual-close avec `[closes A][closes B]` dans le commit fix. Précédent : DAT-003/004, DAT-032/033.

---

## Deferred / non-bloquant
- **PERF-001** (Phase 2, TODO, stub différé) : fan-out d'émission audit par-document sur les endpoints list ; différé délibérément.

## Known pre-existing dette
- **ESLint 9.39.1 + ajv breakage** dans le job lint CI (conflit ajv/eslintrc). Rouge **avant** TOOL-COH-001 ; non touché, hors scope.
- **BUILD-001** (Phase 13, TODO) : `rootDir` structurel non pinné (workaround `exclude scripts/**` + `vitest.int.*` déployé).
- **TOOL-DBSYNC-001** (Phase 1, TODO) : `_dat005_backup_*` drift bloque `prisma migrate dev --create-only`. Workaround hand-author + `migrate deploy` utilisé pendant toute la Phase 3 + mini-arc. Décision structurelle à prendre (drop tables vs accepter le drift permanent vs autre).

---

## Process learnings — arc audit (original)
- **Constraints-not-prescriptions dans les prompts** : donner les invariants/le scope, laisser Claude dériver le mécanisme.
- **Pre-flight thorough** : grep-confirmer qu'une couche existe AVANT de filer une task (AUD-READ-001 d'abord BLOCKED — la presupposition était fausse).
- **Ground truth depuis serveur/code AVANT de prescrire un plan de deploy** : vérifier l'état réel.
- **Anchor commit pattern pour closures rétroactives** : empty anchor commit, jamais pointer `Closed_by` sur un fix upstream nommant une autre task.

## Process learnings — Phase 3 (9, established in the audit-prescribed arc)
1. **CHECK/regex = defense floor, not DTO equality.** La contrainte DB doit être un *superset* (jamais plus stricte) de la validation app-layer, sinon une entrée légitime côté app est rejetée par la DB (DAT-013 regex lenient ⊇ PredefinedTask DTO).
2. **Auto-sync vs validate-and-reject triggers.** Quand une colonne est une projection dérivée (service mappe codes non-enum → OTHER), utiliser un trigger d'auto-sync qui en fait un *read-only mirror* ; un trigger validate-and-reject rejetterait à tort la divergence légitime (DAT-014). Plus : `enum_range(NULL::"Type")` comme guard contre futurs membres d'enum dans la coercion.
3. **BEFORE INSERT/UPDATE self-traversal trigger sees the OLD row.** Une CTE récursive walking sa propre table doit exclure la ligne en cours d'UPDATE via `(TG_OP='INSERT' OR id <> OLD."id")` sur chaque branche de la CTE, sinon false-positive sur UPDATE-repoint. Détectable **uniquement** en intégration real-DB (pas unit/typecheck) — DAT-018. **Cette recette s'est reproduite verbatim sur DAT-038 (events parent cycle) — UPDATE-positive test obligatoire confirmé sur prod.**
4. **Prisma error-shape asymmetry.** `$executeRawUnsafe` *drop le nom de l'index* du 23505 (unique_violation) mais *préserve le nom de la contrainte* du 23514 (check_violation). Asserter les witnesses UNIQUE sur le tuple `Key (<cols>)=`, les witnesses CHECK sur le nom de contrainte (DAT-016). **Prisma a 0 code dédié pour 23P01 (exclusion_violation)** — détecter via `err.message.includes('<constraint_name>') && err.message.includes('23P01')` (COR-037).
5. **Hand-authored byte-equivalent migration.** Quand `migrate dev --create-only` est drift-blocked (TOOL-DBSYNC-001), hand-author la migration pour matcher exactement la sortie de migrate dev (convention Prisma index/constraint naming) et appliquer via `migrate deploy` (DAT-016 / DAT-036 pour DSL-expressible ; DAT-003/004/013/014/017/018/023/032/033/035/037/038 étaient raw-SQL-only de toute façon).
6. **DSL-expressibility split.** CHECK / triggers / EXCLUDE sont raw-SQL-only, `schema.prisma` *untouched* ; UNIQUE / FK / enum-promotion sont Prisma-DSL-expressible, `schema.prisma` *édité*. Détermine per-task si `schema.prisma` change.
7. **Layer-of-rejection discipline.** Race-window-after-pre-check → catch P2002/23P01/P0001 → 409 (COR-034/037/038) ; pre-checkless plainly-invalid input → DTO-side 400 (COR-035). Chaque couche rejette ce qui est *sa* responsabilité.
8. **Audit-literal validation.** Le pre-flight vérifie que le SQL littéral de l'audit est correct pour CE codebase (DAT-023 a confirmé que `'[]'` bounds, partial WHERE, no `::date` cast sont tous corrects en inspectant `checkOverlap` + le schema `@db.Date`) plutôt que blind-follow OU sur-interpréter. Ni l'un ni l'autre des extrêmes : vérifier.
9. **Don't-file-phantoms (inverse du closeout-filing).** Quand le pre-flight prouve qu'une adjacency ne leak pas vraiment OU que le littéral couvre déjà le cas, NE PAS filer un follow-up (COR-036, DAT-039 non-filings). **L'inverse tient aussi** : quand le pre-flight prouve qu'une adjacency LEAK (DAT-038 sans service-layer guard), filer COR-038. Symétrie de la discipline.

## Process learnings — mini-arc + prod-deploy (5, new)
10. **Cross-table consistency under MUTABLE parents : REJECT-bidirectional deadlocks ; AFTER-UPDATE CASCADE résout.** Quand les deux parents d'une cross-table equality sont mutables (epic.projectId AND milestone.projectId), deux triggers BEFORE REJECT face-à-face bloquent les workflows légitimes (« déplacer un epic d'un projet à un autre » devient impossible : chaque côté refuse à cause de l'autre). La cascade AFTER UPDATE sur les parents propage NEW.projectId aux tasks dépendantes ; non-deadlocking par construction (AFTER fire post-row-update, le cascade UPDATE sur tasks satisfait le BEFORE re-check). **Prouvé non-deadlocking sur prod 2026-05-28** (Gate-5 smoke : UPDATE epic.projectId déplace 2 tasks). DAT-037 Option A est le pattern à réutiliser pour toute future invariant cross-table parent-enfant sous parents mutables.
11. **Open-value-space resolution.** Un champ qui a bailé de l'enum-ification ET dont le pre-flight prouve l'espace de valeurs genuinely open (institutional per-collectivité) prend un length/bounds CHECK + DTO normalization comme son defense floor — PAS un enum, PAS un CHECK-against-list. Avec un design-contract test qui pin le gap intentionnel DB-laxer-than-DTO (ex: DAT-035 admet whitespace-only au DB parce que le DTO trim). Pattern : « le DB est le superset structurel, le DTO est la stricte canonicalisation ».
12. **Mono-prompt + hard halt-gates valide.** 2 sessions autonomes du mini-arc (8 tasks fermées + 2 HALT-and-resume sur design decisions) ont validé le pattern : self-drive le happy path, halt clean sur les vrais judgment points (DAT-037 design REJECT vs CASCADE, DAT-035 enum vs free-form), résumer dans une session suivante après operator decision. **Detailed-but-factored prompt** (protocole partagé une fois en tête + blocs per-task compacts) bat N specs répétées en fidélité d'exécution.
13. **Accumulate-then-re-finalize deploy-doc pattern.** Marche bien pour un arc multi-task (mini-arc 9/9), mais nécessite un **banner explicite à chaque transition d'état** (`accumulating` ↔ `finalized`) pour empêcher l'opérateur de déployer mid-arc. **Future arcs : START A NEW deploy doc** plutôt que d'appender à une doc finalisée et déployée. Le pattern est : seed → per-task append (accumulating banner) → finalize (cleanup, unified checklist) → DEPLOY → execution log appended. Reproduire pour Phase 4.
14. **Deploy-time ground-truth : vérifier `_prisma_migrations` réel, ne pas faire confiance au baseline encodé dans la doc.** Gate-0 du deploy 2026-05-28 a catch un baseline stale dans la doc Phase-3 (le doc disait « expected last applied = `20260524100100_dat005` », réel = `20260526120000_dat021…` parce que Phase 2 avait été déployée out-of-band). Delta safe quand même (Prisma calcule depuis `_prisma_migrations`, pas depuis la doc) mais la confusion potentielle est réelle. **Process : Gate-0 toujours probe `SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5` avant de faire confiance au baseline du doc.**

## Process learnings — Phase 4 Cluster A (2, new)
15. **`@Global()` decorator discovery AVANT module wiring.** Quand un service RBAC ou audit semble nécessiter un import explicite dans un Module, vérifier d'abord son decorator `@Global()` — `RbacModule` l'est, donc `PermissionsService` est injectable partout sans `imports[]`. Réflexe : `grep -r "@Global()" apps/api/src` avant d'ajouter un `imports[]` à un module. L'étape « update EpicsModule/MilestonesModule » anticipée par les contrats COR-001 + COR-002 était un **no-op des deux fois** (modules laissés untouched ; file scope = 2 fichiers service+spec, pas 3). Ajouter l'import redondant aurait été un smell.
16. **AC#4 path-specific, jamais hérité du sibling.** Ne pas hériter « AC#4 N/A » d'un commit jumeau sur la seule base « même nature de fix » — vérifier la raison précise par closure (read-gate vs mutation), pas la présence/absence d'infra audit dans le file. Démonstration COR-002 : milestones **IMPORTE** l'infra audit (`AuditPersistenceService`/`emitDataExported`, OBS-026 CSV export) mais COR-002 reste N/A **parce que `assertProjectMembership` est un read-gate** (assert, pas de mutation), PAS parce que « milestones n'a pas d'audit » (le wording faux qu'on aurait transcrit depuis COR-001). Reinforcement discipline contre l'inheritance lazy entre siblings — corollaire de #9 (don't-file-phantoms) côté AC-verification.

---

## Next session — Phase 4 Cluster A done, 4 tasks remaining

**Immediate cleanups vidés** — COR-038 (`24c6929`) + DOC-001 (`006adb7`) closes. Phase 4 ouverte, **Cluster A (guard-hardcoding) done** (COR-001/002), **4 tasks restantes** réparties sur 2 clusters thématiques (rappel : champ BACKLOG `Cluster:` = B pour les 6 ; A/B/C = overlay kickoff).

### 3 judgment points GRAVÉS (pré-flightés au kickoff Phase-4 — NE PAS re-découvrir au prochain pick)

Ces 3 nuances ont été établies à la prep Phase-4 ; elles persistent ici pour que la session de pick suivante n'ait pas à les ré-investiguer from scratch.

- **COR-028 — reachability nuance.** Le failure mode « exposes any user's leaves » n'est **PAS exploitable aujourd'hui** : le seul caller est `getMyLeaves`, qui passe `@CurrentUser('id')` (JWT-scoped). Finding valide comme **defense-in-depth hardening**, PAS comme exploit fix. Arbitrage opérateur à mettre dans le prompt d'exécution : assert userId-equality OU rename en `getOwnLeaves(currentUserId)`. Plus petit blast radius des 4 restantes.
- **TST-018 — audit-presupposition à corriger.** Ni `UpdateUserDto` ni `CreateUserDto` n'ont de champ `roleId` — la suggested test de l'audit (« PATCH avec `roleId` in body, assert stripped ») est **moot**. Le vrai role-change path doit être **localisé d'abord** (probablement `rbac/roles.controller updateRole`). Witness target = le path réel, PAS la presupposition audit. Ajuster le scope AVANT le pick.
- **SEC-030 — design surface net-new.** `AccessScopeService.userReadWhere` **n'existe pas** — le mécanisme = créer la méthode, miroir `taskReadWhere`/`documentReadWhere`. Plus grosse surface de design des 4. Seul vrai judgment point = la **shape exacte du scope** (self / same-service / managed-services). Adjacence observée à NE PAS pré-file : `GET /users` (list, 1000/page) est aussi unscoped — la noter, ne pas la filer maintenant.

### Reco séquence (arguments, PAS pré-décision)
- **Cluster B (scope) avant Cluster C (test)** : les fixes scope-side stabilisent la matrice de permissions avant que TST-001 ne la diff. Faire TST-001 d'abord = diff contre une cible mouvante.
- **Dans Cluster B** : COR-028 (smaller blast radius, defense-in-depth) avant SEC-030 (larger design surface) — OU l'inverse si l'opérateur veut bâtir `userReadWhere` réutilisable tôt et le valider en staging-play. Argument non tranché ici.

### Deltas runtime undeployed (non-bloquant pour les picks)
3 fixes code-only sur master, pas en prod : COR-038 `24c6929` + COR-001 `cb3b5e1` + COR-002 `27c0424`. Pas de migration, pas de DB change. L'opérateur peut **bundle-deploy au premier deploy Phase-4** OU **micro-deploy avant de continuer**. Non-bloquant pour les 4 picks restants (tous code/spec, pas de dépendance sur l'état prod).

**Implementation flags carry-forward (Phase 4 restante) :**
- **CODE résout les permissions via templateKey, JAMAIS de role-code hardcodé** ([[feedback_no_hardcode_hotfix]] + [[project_rbac_seed_silent_skip]]). Discharge sur epics+milestones (Cluster A) ; demeure pour scope/test tasks.
- **API computed flags** per resource (canEdit/canDelete), jamais calculé côté frontend ([[feedback_api_computed_flags]]).
- **SEC-002 / SEC-003 ont établi le pattern hierarchy + self-protection** ; SEC-030 étend `AccessScopeService` (méthode net-new `userReadWhere`).
- **DAT-037 silent cascade est live** — toute task RBAC touchant projet ownership doit prendre en compte que `epic.projectId` UPDATE re-écrit les tasks (impact transitif sur scope).

---

## Preserve / unchanged

Les sections suivantes restent inchangées et toujours valides :
- Phase 1 (audit-prescribed + tooling) tables et SHAs.
- Phase 2 audit-log durcissement (20/21 DONE + PERF-001 deferred).
- Phase 3 + completion mini-arc (20 tasks DONE, LIVE en prod `ebcd9e1`) — tables et SHAs.
- Phase 4 Cluster A (COR-001 `cb3b5e1` + COR-002 `27c0424`, guard-hardcoding) — clos, parties préservées.
- `audit_logs` 5-couche defense-in-depth.
- Infra patterns récurrents (coherence gate, real-DB harness, throwaway-DB witness, anchor-commit retroactive closure).
- Process learnings : arc audit original (4 bullets), Phase-3 #1–#9, mini-arc + prod-deploy #10–#14, Phase-4 Cluster A #15–#16.
- Known dette pre-existing (ESLint/ajv, BUILD-001, TOOL-DBSYNC-001 ; **+TOOL-COH-003** comme nouveau membre filed — bruit de gate `Closed_by`-format, BACKLOG-formatting-only).

---

## Invocation prompt for fresh Claude session
```
exécute le prompt du fichier handover en KB
```
