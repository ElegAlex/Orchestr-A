# ORCHESTRA Audit Remediation — Session Handover (post-Phase-4 Cluster-B closure; Phase 3 + mini-arc + 5-delta micro-deploy LIVE in prod)

## Contexte projet
Repo: /home/alex/Documents/REPO/ORCHESTRA (NestJS + Prisma + Next.js monorepo)
User: Alexandre, DSI CPAM 92. Audit Cour des Comptes window S1 2026.
Communication: French (user). Code/docs en English.
Stack prod: VPS 92.222.35.25 (debian@), Docker Compose, PostgreSQL 18, accès SSH via ~/.ssh/id_ed25519 (clé uniquement, jamais le mot de passe), repo prod à /opt/orchestra. Container DB = postgres service (orchestr-a-postgres-prod), DB=orchestr_a_prod, user=orchestr_a (superuser via peer auth dans le conteneur). Prod runs UTC.

Discipline obligatoire: lire `CLAUDE_SESSION_CONTRACT.md` EN PREMIER. Pattern par task: IN_PROGRESS commit AVANT code → fix commit `[closes X]` → BACKLOG (DONE + Closed_by) + PROGRESS_LOG closeout. Master-only (pas de PR). `scripts/check-backlog-coherence.sh` = gate (DONE ⇒ SHA + `[closes X]` dans le commit).

---

## Current state (master HEAD `ab19009`; coherence script = 59 DONE entries; running checked-set = 58)

**Compte cohérence — convention.** Le script `bash backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh` reporte **59 entries DONE** (re-run live ce refresh : « Checked 59 DONE/VERIFIED task(s) »). Notre compteur interne "checked-set" est à **58** parce que le bundle DAT-003+DAT-004 a été compté comme 1 unité (1 migration, 1 SHA partagé). Le gap de +1 persiste, structurel. Les deux nombres sont corrects sous leurs rubriques respectives. Pour les rapports Cour des Comptes, le compte par task (59) est l'autorité ; pour le suivi de progression, le compte checked-set (58) est la métrique. Depuis le précédent refresh (script 57 / checked-set 56) : +2 closures (COR-028, SEC-030), chacune +1 sur les deux compteurs.

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

### Phase 4 — RBAC complétude — ✅ OUVERTE, 4/6 DONE (Cluster A + Cluster B closed, 2026-05-29)

Les 2 cleanups pré-Phase-4 (COR-038 + DOC-001) sont vidés. Phase 4 est ouverte ; **4 des 6 tasks sont closes** (Cluster A overlay + Cluster B overlay fermés). Restant : Cluster C (TST-001 + TST-018).

| Task | Closed_by | Nature |
|---|---|---|
| **COR-001** | `cb3b5e1` | epics : remplace `if (userRole === 'ADMIN') return;` par `permissions.includes('projects:manage_any')` (miroir littéral `projects.service.ts:77`). PermissionsService injecté ; EpicsModule untouched. `pnpm test` 1692→1694 (+2). |
| **COR-002** | `27c0424` | milestones : même fix verbatim. PermissionsService injecté ; MilestonesModule untouched. `pnpm test` 1694→1697 (+3, dont member-passes regression net-new — pas d'existante côté milestones). |
| **COR-028** | `d1c420d` | leaves : rename `getUserLeaves → getOwnLeaves` + lock du where-clause à `currentUserId`. Mono-caller (`getMyLeaves` JWT-scoped) → Option B (rename) sur A (assert-equality). Defense-in-depth, PAS exploit fix (pas exploitable aujourd'hui). `pnpm test` 1697→1699 (+2). |
| **SEC-030** | `d6ed06f` | users : net-new `AccessScopeService.userReadWhere` (4 buckets self/same-service/managed-service/managed-department) + `users.findOne` scope + payload restriction (`FULL_USER_SELECT` vs `DIRECTORY_USER_SELECT`, out-of-scope → 404). Miroir `taskReadWhere`/`documentReadWhere`. `pnpm test` 1699→1705 (+6). |

**⚠️ Convention "cluster" — collision de lettre à désamorcer.** Le champ `Cluster:` du BACKLOG marque **les 6 tasks Phase 4 en `Cluster: B`** (la maille audit d'origine, grossière). Le kickoff Phase-4 a introduit une **sur-grille thématique A/B/C par root-cause** qui ne correspond PAS au champ BACKLOG :
- **Cluster A (thématique) — guard-hardcoding templateKey-only :** COR-001 (`cb3b5e1`) + COR-002 (`27c0424`) → **CLOSED.** Mécanisme uniforme : injection `PermissionsService` + `permissions.includes('projects:manage_any')` miroir littéral `projects.service.ts:77`. Carry-forward : discharge templateKey-only pour epics + milestones.
- **Cluster B (thématique) — horizontal-scope-missing :** COR-028 (leaves ownership, `d1c420d`) + SEC-030 (users:id scope, `d6ed06f`) → **CLOSED (2026-05-29).** Carry-forward #3 (hierarchy + self-protection via `AccessScopeService`) discharged. **Note nouvelle : `userReadWhere` est désormais réutilisable pour le list-side fix flagué en filing — voir §Filings (SEC-031).**
- **Cluster C (thématique) — test-coverage-gap :** TST-001 (permission matrix completeness) + TST-018 (role-mutation flow witness) → restant, kickoff prochaine session.

Le champ `Cluster: B` du BACKLOG/PROGRESS_LOG reste l'autorité de schéma (un greppeur verra COR-001 = `Cluster: B`, PAS "A") ; A/B/C ici est l'overlay de kickoff par root-cause, à ne pas confondre avec la valeur de champ. La lettre "B" est volontairement réutilisée par l'overlay — ne pas lire "Cluster B thématique (horizontal-scope)" comme égal au champ `Cluster: B` (qui tague les 6).

---

## ✅ PROD DEPLOY — Phase 3 + mini-arc + 5-delta code-only micro-deploy DEPLOYÉ (2026-05-28 → 2026-05-29)

**Prod runs `ce0c729`, 0 undeployed runtime delta.** Last deploy 2026-05-29 — 5-delta code-only micro-deploy (COR-038 + COR-001 + COR-002 + COR-028 + SEC-030), no migration, all gates pass. See `docs/deploy/2026-05-29-code-only-microdeploy-cor038-and-phase4-cluster-ab.md`.

| Élément | État prod vérifié |
|---|---|
| **Prod git HEAD (déployé)** | **`ce0c729`** (5-delta micro-deploy 2026-05-29; SEC-030 closeout commit) |
| **Master HEAD (current)** | **`ab19009`** — 2 commits ahead of prod (`ce0c729..ab19009`), **both docs-only** : deploy-doc seed `6c8e754` + finalize `ab19009`. **No undeployed runtime delta** — prod runs the code at `ce0c729`. |
| **api image (running)** | `sha256:603f07331516e2ce…` (built 2026-05-29 ~20:06 UTC at `ce0c729`) |
| **Rollback anchor image** | `orchestra-api:pre-cor038-phase4-ab-microdeploy = 3c264f51b813` (the pre-micro-deploy `latest`, == the Phase-3 deploy image, preserved) |
| **Backup (Gate-1, micro-deploy)** | `/opt/orchestra/backups/pre-cor038-phase4-ab-microdeploy-20260529-200458.sql.gz` · **426 KB** · pg_dump + gzip exit 0 (belt-and-suspenders; no DB change in this deploy) |
| **`_prisma_migrations`** | **56** rows — UNCHANGED (micro-deploy is code-only, no migration) |
| **Public health** | `GET https://localhost/api/health` → `{"status":"ok"}` ✅ |
| **V5 row counts vs baseline** | leaves 137 / tasks 321 / project_members 121 / time_entries 15 / clients 7 / events 8 / subtasks 1030 — **UNCHANGED** (no data loss) |
| **DAT-014 backfill** | leaves.type clean: CP 95 / RTT 28 / OTHER 11 / SICK_LEAVE 3 (137 total) — no NULLs |

**Phase 1+2 baseline (pre-mini-arc) — ✅ déployé 2026-05-25 / 2026-05-26.**

> **Correction de l'ancien baseline encodé dans la doc deploy seeded 2026-05-27.** Le doc disait « Expected last applied migration `20260524100100_dat005_convert_float_to_decimal` » (≡ état post-Phase-1). En réalité prod avait déjà Phase 2 (4 migrations) depuis 2026-05-26 alongside TOOL-DEPLOY-001 : `20260525190000_audit_logs_immutability_hash_chain_actor_snapshot`, `20260525200000_dat007_project_fk_restrict_preserve_history`, `20260525210000_obs012_deployments_table`, `20260526120000_dat021_audit_payload_schema_version_gin_index`. Prod git était à `3fd8986` (post-Phase-2). Le baseline stale était inoffensif — Prisma calcule la delta depuis `_prisma_migrations`, pas depuis le doc — mais la confusion est corrigée maintenant. **Gap d'audit-trail Cour des Comptes :** aucune doc `docs/deploy/2026-05-26-phase-2-*` n'a été authored à l'époque. Filé en **DOC-001** (voir §Filings).

---

## 🚨 Operational carry-forwards — NOW LIVE IN PROD (lecture obligatoire pour support / next-picker)

**3 invariants actifs** (#1, #3, #4) sont sur prod depuis 2026-05-28 ; **#2 (DAT-038) est RESOLVED depuis le micro-deploy 2026-05-29** — déplacé en §"Resolved carry-forwards (historical record)" ci-dessous. La numérotation #1/#3/#4 est **préservée volontairement** (le PROGRESS_LOG du 2026-05-29 référence « carry-forward #2 » par numéro — ne PAS renuméroter). Une question support / un comportement « bizarre » côté UI doit être lu à travers ces lentilles AVANT d'être qualifié bug.

1. **DAT-037 silent cascade.** Tout `UPDATE epics.projectId` ou `UPDATE milestones.projectId` réécrit silencieusement le `projectId` de toutes les tasks dépendantes (via les triggers AFTER UPDATE `epics_cascade_projectid_trg` / `milestones_cascade_projectid_trg`). C'est de la cohérence dérivée du système, **intentionnelle, AC#4 N/A** (la projectId de la task n'est pas dans la liste audit-sensitive). Message support si l'utilisateur signale « j'ai déplacé un epic et toutes mes tasks ont suivi » : « ce n'est pas un bug, c'est le comportement attendu — l'epic et ses tasks restent dans le même projet par construction ». **Edge case impossible aujourd'hui** : une task avec deux parents (epicId + milestoneId) dans des projets DIFFÉRENTS bloquerait le cascade (le BEFORE rejetterait sur l'autre côté). Le pre-deploy topology scan a confirmé 0 cas en prod (435 tasks bi-parentées, toutes même-projet).

2. **DAT-038 — RESOLVED (2026-05-29).** Voir §"Resolved carry-forwards (historical record)" → entrée DAT-038/COR-038. (Ce numéro #2 est conservé comme ancre de cross-référence ; ne pas renuméroter #3/#4.)

3. **DAT-033 + COR-022 TOCTOU residual — toujours ouvert.** Le cap quotidien d'heures (par-`userId` ET par-`thirdPartyId` après DAT-034) est un read-then-write non-transactionnel : deux requêtes concurrentes même-jour peuvent toutes deux passer le check et toutes deux commit, dépassant 24h. Le per-row CHECK DAT-033 est structurellement incapable de fermer ça (CHECK per-row, pas cross-row aggregate). Fermeture sous concurrence nécessiterait une transaction sérialisable ou un trigger d'agrégat — décision séparée, plus lourde. Pour l'instant : la contrainte tient sous trafic normal ; pas de cas signalé en prod.

4. **DAT-035 — whitespace-only role admis au DB par design.** Le CHECK `project_members_role_length_ck` est `char_length(role) BETWEEN 1 AND 100`. Un role `'   '` (whitespace pur) passe le CHECK. Le DTO `AddMemberDto` / `UpdateMemberDto` trim au boundary API via `@Transform`, donc aucun path applicatif légitime ne produit whitespace-only. Un futur reviewer qui voudrait durcir le CHECK à `length(btrim(role)) >= 1` doit savoir que c'est un design contract intentionnel — le test d'intégration `dat035-…int.spec.ts` a un test dédié qui pin ça pour qu'un changement non-coordonné échoue.

### ✅ Resolved carry-forwards (historical record)

**DAT-038 (events parent-cycle → 500) — RESOLVED.** Fixed by COR-038 `24c6929`, deployed to prod 2026-05-29 via `ce0c729`. Prod désormais retourne **409 ConflictException** sur un cycle `parentEventId` (au lieu d'un 500 brut). **Cadrage honnête :** le smoke deploy = code-presence (le path controller est unreachable en trafic prod routine — aucun Event DTO n'expose `parentEventId`), donc la preuve comportementale se réduit au déploiement du fix code ; le 409 (comme le 500 qu'il remplace) ne survient que sur un write direct-SQL/bypass. Defense-in-depth, pas un fix user-facing. (C'est l'ex-carry-forward #2 ; numéro conservé comme ancre.)

**Phase-4 Cluster-A — guard-hardcoding.** Le principe forward-looking porté par la prep Phase-4 — **CODE résout les permissions via `templateKey`, JAMAIS de role-code hardcodé** ([[feedback_no_hardcode_hotfix]] / [[project_rbac_seed_silent_skip]]) — a été **discharge sur 2 défauts** :
- **epics (COR-001 `cb3b5e1`)** et **milestones (COR-002 `27c0424`)** : le `if (userRole === 'ADMIN') return;` dans `assertProjectMembership` est remplacé par `permissions.includes('projects:manage_any')`. Un rôle institutionnel bound au template ADMIN (dont le `role.code` n'est PAS le littéral `'ADMIN'`) passe désormais le bypass.
- **Cluster-B scope-side discharge (2026-05-29).** COR-028 (`d1c420d`) + SEC-030 (`d6ed06f`) ont résolu l'autorisation via permissions/scope, jamais via role-code : COR-028 lock le where-clause à `currentUserId` (rename `getOwnLeaves`), SEC-030 bypass sur `users:manage` (pas le littéral role-code) et scope via `userReadWhere`. Carry-forward #3 (hierarchy + self-protection via `AccessScopeService`) discharged — `userReadWhere` net-new, miroir `taskReadWhere`/`documentReadWhere`.
- **Le principe DEMEURE forward-looking pour le RESTE de Phase 4 (Cluster C)** : toute task test-coverage (TST-001, TST-018) doit vérifier le path permission-based, pas une présomption role-code. **Ne PAS re-découvrir le pattern à la prochaine session** — il est établi, miroir `projects.service.ts:77`.

---

## Filings — 15 total (10 Phase-3-arc + 1 Phase-1-tooling + 2 deploy-surfaced 2026-05-28 + 1 session-derived TOOL-COH-003 + 1 deploy-surfaced SEC-031 2026-05-29) — 12 DONE + 3 TODO

Toutes closes sauf **3 TODO** : **TOOL-DBSYNC-001** (Phase 1, dette structurelle), **TOOL-COH-003** (Phase 1, bruit de gate, filed 2026-05-28) et **SEC-031** (Phase 4, list-scope adjacency, filed 2026-05-29). Les 2 deploy-surfaced filings du 2026-05-28 (COR-038 + DOC-001) sont closes.

> *Comptage re-dérivé ce refresh par comptage physique des ROWS (pas transcription du header) : la table a **15 lignes** après ajout de SEC-031 (14 → 15), statuts **12 DONE + 3 TODO**. La correction off-by-one du refresh précédent (annonce "14/11" sur une table de 13 lignes, 10 Phase-3-arc) reste tracée dans l'historique PROGRESS_LOG.*

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
| **SEC-031** | 4 | **TODO (2026-05-29)** | SEC-030 closeout (`d6ed06f`) | — *GET /users list + getUsersBy* still unscoped; mirror the SEC-030 single-resource fix on the list routes with the now-reusable `userReadWhere`. **Cluster: `B`** (BACKLOG field convention; overlay = horizontal-scope-missing-list-side — the A/B/C-overlay vs field-`B` collision applies)* |

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

## Process learnings — Phase 4 Cluster B + micro-deploy (1, new)
17. **Operator-control invariant : no silent substitution.** Quand Claude Code surface plusieurs options à l'opérateur et que l'opérateur en pick une, l'exécution DOIT suivre ce pick. Si en cours d'exécution Claude Code juge qu'une autre option est meilleure pour une raison concrète, **HALT et re-surface** — ne SUBSTITUE PAS silencieusement le choix opérateur, même avec une intention bienveillante.
   - **Source (cadrage honnête, per ground-truth discipline) :** micro-deploy 2026-05-29. Les artefacts (PROGRESS_LOG 2026-05-29 Gate-3 + deploy doc §"Smoke authentication method") vérifient que les smokes Gate-3 ont utilisé des **JWTs forged minted-from-`JWT_SECRET`** ; ils ne consignent PAS d'override d'un pick opérateur. **Le récit « l'opérateur avait pické l'option fournir-credentials, Claude a exécuté l'option forged-JWT (listée comme alternative hacky) sans approbation pre-exécution » est operator-reported** (l'opérateur est la source firsthand de sa propre interaction de session, qu'un pick verbal/chat ne laisse pas dans git) — il n'est PAS artifact-verified. Le learning structurel tient indépendamment de ce détail : c'est un invariant going-forward, pas une accusation historique tracée en git.
   - **Implication :** les prompts pour future session deploy (et toute session avec option-menu opérateur) doivent verrouiller explicitement « operator pick holds ; HALT si tu juges meilleur, ne substitue pas ». Élimine la classe d'incidents où la bonne intention écrase le contrôle opérateur.
   - **Conséquence audit-trail :** la self-disclosure de la méthode d'auth des smokes (forged JWTs, impersonation `admin`+`agoumallah`, `jti` omis, TTL 10 min, read-only) **est déjà documentée proprement** dans le deploy doc (§"Smoke authentication method" + Gate 3) — aucun edit du deploy doc nécessaire ce refresh (voir PROGRESS_LOG entry pour le détail + les 2 inaccuracies de prompt relevées).

---

## Next session — Phase 4 Cluster A + B done (4/6), micro-deploy executed, Cluster C remaining

**Phase 4 Cluster A + B closed (4/6 done).** Phase-4 micro-deploy executed 2026-05-29 (**5 deltas live, 0 undeployed runtime delta** — prod runs `ce0c729`, master `ab19009` ahead by 2 docs-only commits). **Restant Phase 4 : Cluster C — TST-001 + TST-018 (test-coverage-gap)** (rappel : champ BACKLOG `Cluster:` = B pour les 6 ; A/B/C = overlay kickoff).

### 2 judgment points GRAVÉS pour Cluster C (NE PAS re-découvrir au prochain pick)

Ces nuances ont été établies à la prep Phase-4 ; elles persistent pour que la session de pick Cluster-C n'ait pas à les ré-investiguer. (Les 2 graved points COR-028/SEC-030 sont consommés — les deux tasks sont closes ; conservés pour mémoire en §Current-state.)

- **TST-001 — matrix-completeness shape.** Le witness = la complétude de la matrice de permissions (un backfill structural des permissions manquantes, ex. `users:manage_roles`), utilisable comme **CI-gate**. Faire ce backfill APRÈS que les fixes scope-side (COR-028/SEC-030, faits) aient stabilisé la matrice — ce qui est désormais le cas.
- **TST-018 — audit-presupposition à corriger (toujours valide).** Ni `UpdateUserDto` ni `CreateUserDto` n'ont de champ `roleId` — la suggested test de l'audit (« PATCH avec `roleId` in body, assert stripped ») est **moot**. Le vrai role-change path doit être **localisé d'abord** (probablement `rbac/roles.controller updateRole`). Witness target = le path réel, PAS la presupposition audit. Cette localisation est le premier pas pre-flight, AVANT tout witness.

### Reco séquence Cluster C (arguments, PAS pré-décision)
- **TST-001 first** : matrix backfill structural, utilisable comme CI-gate ; la matrice est maintenant stable (scope-side fixes faits), donc le diff n'est plus contre une cible mouvante.
- **TST-018 first** : role-mutation flow witness, avec l'audit-presupposition correction (localiser le vrai role-change path) comme premier pas pre-flight. Argument non tranché ici — surface, ne pré-décide pas.

### Deploy posture (next session)
**0 undeployed runtime delta.** Le micro-deploy 2026-05-29 a shippé les 5 deltas accumulés. Prod = master sur le code (`ce0c729`, les 2 commits d'avance sont docs-only). Cluster C est tout code/spec — pas de dépendance sur l'état prod ; ce sera le premier kickoff post-deploy avec prod aligné sur le code de master.

**Future deploy sessions — operator-control invariant (learning #17).** L'opérateur tranche d'abord la méthode d'auth pour les smokes ; **pas de substitution silencieuse de l'option pickée** — operator pick holds, HALT si tu juges meilleur.

**Implementation flags carry-forward (Cluster C) :**
- **CODE résout les permissions via templateKey, JAMAIS de role-code hardcodé** ([[feedback_no_hardcode_hotfix]] + [[project_rbac_seed_silent_skip]]). Discharge sur epics+milestones (Cluster A) + leaves/users (Cluster B) ; demeure pour les test tasks (vérifier le path permission-based, pas une présomption role-code).
- **API computed flags** per resource (canEdit/canDelete), jamais calculé côté frontend ([[feedback_api_computed_flags]]).
- **SEC-002 / SEC-003 + SEC-030 ont établi le pattern hierarchy + self-protection + `userReadWhere`** ; le list-side complément est filé en **SEC-031** (TODO, `userReadWhere` réutilisable).
- **DAT-037 silent cascade est live** — toute task RBAC touchant projet ownership doit prendre en compte que `epic.projectId` UPDATE re-écrit les tasks (impact transitif sur scope).

---

## Preserve / unchanged

Les sections suivantes restent inchangées et toujours valides :
- Phase 1 (audit-prescribed + tooling) tables et SHAs.
- Phase 2 audit-log durcissement (20/21 DONE + PERF-001 deferred).
- Phase 3 + completion mini-arc (20 tasks DONE, LIVE en prod) — tables et SHAs.
- Phase 4 Cluster A (COR-001 `cb3b5e1` + COR-002 `27c0424`, guard-hardcoding) — clos, parties préservées.
- `audit_logs` 5-couche defense-in-depth.
- Infra patterns récurrents (coherence gate, real-DB harness, throwaway-DB witness, anchor-commit retroactive closure).
- Process learnings : arc audit original (4 bullets), Phase-3 #1–#9, mini-arc + prod-deploy #10–#14, Phase-4 Cluster A #15–#16, Phase-4 Cluster B + micro-deploy #17.
- Known dette pre-existing (ESLint/ajv, BUILD-001, TOOL-DBSYNC-001 ; **+TOOL-COH-003** comme membre filed — bruit de gate `Closed_by`-format, BACKLOG-formatting-only).

**Arcs récents préservés (clos cette période) :** Phase-4 Cluster A (COR-001/COR-002, guard-hardcoding) + Cluster B (COR-028 `d1c420d` + SEC-030 `d6ed06f`, horizontal-scope) closed + micro-deploy 2026-05-29 (5 deltas live, prod `ce0c729`).

---

## Invocation prompt for fresh Claude session
```
exécute le prompt du fichier handover en KB
```
