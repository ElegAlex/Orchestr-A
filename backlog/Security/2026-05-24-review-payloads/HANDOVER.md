# ORCHESTRA Audit Remediation — Session Handover (post-prod-deploy, Phase 3 + mini-arc LIVE)

## Contexte projet
Repo: /home/alex/Documents/REPO/ORCHESTRA (NestJS + Prisma + Next.js monorepo)
User: Alexandre, DSI CPAM 92. Audit Cour des Comptes window S1 2026.
Communication: French (user). Code/docs en English.
Stack prod: VPS 92.222.35.25 (debian@), Docker Compose, PostgreSQL 18, accès SSH via ~/.ssh/id_ed25519 (clé uniquement, jamais le mot de passe), repo prod à /opt/orchestra. Container DB = postgres service (orchestr-a-postgres-prod), DB=orchestr_a_prod, user=orchestr_a (superuser via peer auth dans le conteneur). Prod runs UTC.

Discipline obligatoire: lire `CLAUDE_SESSION_CONTRACT.md` EN PREMIER. Pattern par task: IN_PROGRESS commit AVANT code → fix commit `[closes X]` → BACKLOG (DONE + Closed_by) + PROGRESS_LOG closeout. Master-only (pas de PR). `scripts/check-backlog-coherence.sh` = gate (DONE ⇒ SHA + `[closes X]` dans le commit).

---

## Current state (master HEAD `5ec83f7`; coherence script = 53 DONE entries; running checked-set = 52)

**Compte cohérence — convention.** Le script `bash backlog/Security/2026-05-24-review-payloads/scripts/check-backlog-coherence.sh` reporte **53 entries DONE**. Notre compteur interne "checked-set" (utilisé tout au long du mini-arc) est à **52** parce que le bundle DAT-003+DAT-004 a été compté comme 1 unité (1 migration, 1 SHA partagé). Les deux nombres sont corrects sous leurs rubriques respectives. Pour les rapports Cour des Comptes, le compte par task (53) est l'autorité ; pour le suivi de progression mini-arc, le compte checked-set (52) est la métrique.

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
- `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md` — seeded 2026-05-27, finalized 2026-05-28 `43ed9a8`, re-finalized post-mini-arc 2026-05-28 `ebcd9e1`, deploy-execution-log appended `5ec83f7` (current master HEAD).
- Counts in the doc are canonical: **20 tasks / 19 scope rows / 13 migrations / 5 code-only / 18 rollback steps** (the DAT-003+004 bundle = 1 row for 2 tasks; the DAT-032+033 bundle = 1 row for 2 tasks but listed in the doc as 2 rows for narrative reasons → 19 scope rows total).

### DAT-007 (Phase 10) — DONE `0eae219`, pickup hors-phase
Pris hors séquence pendant l'arc audit (FK `Task.projectId` Cascade → Restrict, préserve l'historique). Sert de pattern-mirror direct pour USR-DEL-001. **Le reste de Phase 10 (DAT-008/022/025/026) est TODO** — ne pas y toucher avant les décisions de séquence (voir §Next).

---

## ✅ PROD DEPLOY — Phase 3 + mini-arc DEPLOYÉ (2026-05-28)

| Élément | État prod vérifié |
|---|---|
| **Prod git HEAD (déployé)** | **`ebcd9e1`** (re-finalized deploy doc; mini-arc complete) |
| **Master HEAD (current)** | **`5ec83f7`** — adds ONLY the deploy-log doc commit; **NO code delta vs prod** (diff `ebcd9e1..5ec83f7` = `PROGRESS_LOG.md` + `2026-05-2x-phase-3-defense-in-depth-deploy.md` only). **Prod is functionally current.** |
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

2. **DAT-038 — trigger SEUL en première ligne (pas de service-layer guard).** Contrairement à DAT-018 (qui est un DB floor au-dessus de `tasks.service.ts checkCircularDependency` retournant 400), `events.service.ts` n'a PAS d'équivalent. Un path API qui construit un `parentEventId` cyclique tombe sur le trigger P0001 → fuite en HTTP 500 brut. **Filé en COR-038** (mapping 409 + optionnel pre-check service-layer). Avant que COR-038 ne soit clos, support doit s'attendre à des 500 sur ce path précis et savoir que la cause-racine est documentée.

3. **DAT-033 + COR-022 TOCTOU residual — toujours ouvert.** Le cap quotidien d'heures (par-`userId` ET par-`thirdPartyId` après DAT-034) est un read-then-write non-transactionnel : deux requêtes concurrentes même-jour peuvent toutes deux passer le check et toutes deux commit, dépassant 24h. Le per-row CHECK DAT-033 est structurellement incapable de fermer ça (CHECK per-row, pas cross-row aggregate). Fermeture sous concurrence nécessiterait une transaction sérialisable ou un trigger d'agrégat — décision séparée, plus lourde. Pour l'instant : la contrainte tient sous trafic normal ; pas de cas signalé en prod.

4. **DAT-035 — whitespace-only role admis au DB par design.** Le CHECK `project_members_role_length_ck` est `char_length(role) BETWEEN 1 AND 100`. Un role `'   '` (whitespace pur) passe le CHECK. Le DTO `AddMemberDto` / `UpdateMemberDto` trim au boundary API via `@Transform`, donc aucun path applicatif légitime ne produit whitespace-only. Un futur reviewer qui voudrait durcir le CHECK à `length(btrim(role)) >= 1` doit savoir que c'est un design contract intentionnel — le test d'intégration `dat035-…int.spec.ts` a un test dédié qui pin ça pour qu'un changement non-coordonné échoue.

---

## Filings — 14 total (11 Phase-3-arc + 1 Phase-1-tooling + 2 deploy-surfaced 2026-05-28)

Toutes closes sauf les 2 deploy-surfaced filings (COR-038 et DOC-001, TODO).

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
| **COR-038** | 3 | **TODO (2026-05-28)** | Phase 3 prod deploy Gate-5 reminder | — *map event cycle P0001/23514 → 409 (+ optional service-layer pre-check, parallel to DAT-018)* |
| **DOC-001** | 2 | **TODO (2026-05-28)** | Phase 3 prod deploy Gate-0 finding | — *backfill `docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md` for Cour-des-Comptes audit-trail completeness* |

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

---

## Next session — meta cleanups d'abord, puis Phase 4 kickoff

### Immediate cleanups (operator's call on sequencing — both quick, both filed)
- **COR-038** — event-cycle P0001/23514 → 409 wrapper (+ optional service-layer pre-check). Similar mechanic to COR-037 ; reuse the `isLeaveOverlapViolation` shape pour un `isEventParentCycleViolation` helper. Layer-of-rejection partner discipline applies (pre-check 400 vs trigger 409 si on ajoute aussi le service-layer guard). **Estimated effort:** 1 short session.
- **DOC-001** — Phase 2 deploy doc backfill (`docs/deploy/2026-05-26-phase-2-audit-hardening-deploy.md`). Retroactive ; mirror Phase 1 + Phase 3 structure with an explicit « retroactive » banner. Source: `_prisma_migrations` finished_at + PROGRESS_LOG entries from 2026-05-26. **Estimated effort:** 1 short session ; pure docs, no code, no migration.

Both can clear before OR in parallel with Phase 4 prep (no dependency on Phase 4 picks ; COR-038 might bundle with the first Phase 4 task touching events.service.ts ; DOC-001 is independent).

### Then — Phase 4 kickoff (RBAC complétude, 6 tasks)
Phase 4 contient : **TST-001**, **COR-001**, **COR-002** + 3 autres (voir `## Phase 4 — RBAC complétude` ligne 2937 ish du BACKLOG, post-filings). **Ne pas pré-décider l'ordre de pickup ici** — c'est l'objet de la kickoff session : présenter les 6 tasks, identifier le cluster de root-cause (toutes touchent RBAC, mais à des couches différentes : permission matrix coverage / guard logic / scope checks), et choisir une ouverture (la plus grosse correspondance avec le pattern Phase-3 = TST-001 si elle est principalement DB+spec ; sinon COR-001/002).

**Implementation flags à carry-forward pour Phase 4 (en vrac, pour ne rien perdre):**
- **CODE doit toujours résoudre les permissions via templateKey, JAMAIS hardcoder un role code** ([[feedback_no_hardcode_hotfix]] + RBAC V4 compile-time via templateKey [[project_rbac_seed_silent_skip]]).
- **Les permissions API computed flags** doivent venir de l'API per resource (canEdit/canDelete), jamais calculées côté frontend ([[feedback_api_computed_flags]]).
- **SEC-002 / SEC-003 ont établi le pattern hierarchy + self-protection** : Phase 4 RBAC mutations devront probablement étendre `AccessScopeService` ou son équivalent.
- **DAT-037 silent cascade est live** — toute task RBAC qui touche projet ownership doit prendre en compte que `epic.projectId` UPDATE re-écrit les tasks (impact transitif sur scope).

---

## Preserve / unchanged

Les sections suivantes restent inchangées et toujours valides :
- Phase 1 (audit-prescribed + tooling) tables et SHAs.
- Phase 2 audit-log durcissement (20/21 DONE + PERF-001 deferred).
- `audit_logs` 5-couche defense-in-depth.
- Infra patterns récurrents (coherence gate, real-DB harness, throwaway-DB witness, anchor-commit retroactive closure).
- Process learnings arc audit original (4 bullets).
- Known dette pre-existing.

---

## Invocation prompt for fresh Claude session
```
exécute le prompt du fichier handover en KB
```
