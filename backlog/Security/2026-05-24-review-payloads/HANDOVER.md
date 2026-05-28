# ORCHESTRA Audit Remediation — Session Handover (post-Phase-3 completion)

## Contexte projet
Repo: /home/alex/Documents/REPO/ORCHESTRA (NestJS + Prisma + Next.js monorepo)
User: Alexandre, DSI CPAM 92. Audit Cour des Comptes window S1 2026.
Communication: French (user). Code/docs en English.
Stack prod: VPS 92.222.35.25 (debian@), Docker Compose, PostgreSQL 18, accès SSH via ~/.ssh/id_ed25519, repo prod à /opt/orchestra. Container DB = postgres service (orchestr-a-postgres-prod), DB=orchestr_a_prod, user=orchestr_a. Prod runs UTC.

Discipline obligatoire: lire `CLAUDE_SESSION_CONTRACT.md` EN PREMIER. Pattern par task: IN_PROGRESS commit AVANT code → fix commit `[closes X]` → BACKLOG (DONE + Closed_by) + PROGRESS_LOG closeout. Master-only (pas de PR). `scripts/check-backlog-coherence.sh` = gate (DONE ⇒ SHA + `[closes X]` dans le commit).

---

## Current state (master @ `59db83c`, working tree clean, coherence gate = 43 DONE/VERIFIED)

### Phase 1 — blockers audit-prescribed : 7/7 DONE + déployés prod (2026-05-25)
SEC-001 `507d755`, SEC-002 `24bbfe7`, SEC-003 `2763552`, DAT-001 `b14cdd5`, DAT-005 `bcb7ec3`, COR-003 `8fc6c92`, CLAUDE-CFG-001 `a4c3ec2`. Audit-trail: `docs/deploy/2026-05-25-phase-1-remediation-deploy.md`.

### Phase 1 — tooling : 5/5 DONE (déployé prod 2026-05-26)
| Task | Closed_by | Origine | Nature |
|---|---|---|---|
| CLAUDE-CFG-001 | `a4c3ec2` | audit (codex-only) | config repo |
| TOOL-COH-001 | `e6b836c` | session-derived | coherence gate : regex multi-segment `[A-Z]+(?:-[A-Z]+)*-\d+` |
| TOOL-COH-002 | `e6b836c` | session-derived | formalisation du pattern anchor-commit (doc) |
| TST-DB-001 | `e30292c` | session-derived | harness d'intégration real-DB (`vitest.int.config.ts`, `pnpm test:integration`) |
| TOOL-DEPLOY-001 | `8c37e1d` | session-derived | split rôle DB app_user/owner + `directUrl` + `init-roles.sql` |

### Phase 2 — Cour des Comptes audit-log durcissement : 20/21 DONE (PERF-001 stub différé)
**16 audit-sourced :** DAT-002 `c62ac8d`, OBS-001 `1ff6c9a`, OBS-002 `d6299cc`, OBS-003 `1aa24b5`, OBS-004 `330a8eb`, OBS-005 `ec88cc9`, OBS-006 `4bee971`, OBS-007 `4711097`, OBS-012 `189344f`, OBS-018 `986c06f`, OBS-020 `bfc7a78`, OBS-021 `c45f209`, OBS-024 `7393b5d`, DAT-009 `d6299cc`, DAT-021 `33f7a9c`, TST-011 `870cd81`.
**4 session-derived :** AUD-EMIT-001 `ffc4cf4`, OBS-026 `a42d663`, USR-DEL-001 `950068f`, AUD-READ-001 `5f87026`.

### Phase 3 — Defense-in-depth schema — Invariants métier en SQL

**⚠️ Phase 3 is NOT a clean "10/10-and-done" — two distinct counts apply.** Be explicit when reporting state:

- **Phase 3 audit-prescribed: 10/10 DONE.** All ten tasks named in the original audit closed in the 2026-05-27 arc:

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

- **Phase 3 defense-in-depth follow-ups (session-derived, TODO): 10 filings tagged Phase 3, still open.** See catalog below. The Cour-des-Comptes narrative coherence question for the next arc is whether these get cleared first (mini-arc) or deferred behind Phase 4.

> Phase 3 BACKLOG header still reads *« 14 tasks in this phase »* — **stale**. Real count is **20** (10 original audit-prescribed + 10 session-derived). Don't trust the header.

### DAT-007 (Phase 10) — DONE `0eae219`, pickup hors-phase
Pris hors séquence pendant l'arc audit (FK `Task.projectId` Cascade → Restrict, préserve l'historique). Sert de pattern-mirror direct pour USR-DEL-001. **Le reste de Phase 10 (DAT-008/022/025/026) est TODO** — ne pas y toucher avant les décisions de séquence (voir §Next).

---

## Filings nés pendant Phase 3 (11 total — 10 Phase-3-tagged + 1 Phase-1-tagged)

| ID | Phase | Sev | Origine | Nature de la dette |
|---|---|---|---|---|
| **DAT-032** | 3 | important | DAT-004 closeout (`62c2fc4`) | `Subtask.position >= 0` CHECK — named in Description, omitted from literal Suggested-fix |
| **DAT-033** | 3 | important | COR-022 closeout (`760aa58`) | DB-level CHECK on `TimeEntry.hours` (single-entry bound) + per-day cap as DB invariant (COR-022 closed service-layer-only per Invariant 1) — captures the TOCTOU residual |
| **DAT-034** | 3 | nit | COR-022 closeout (`760aa58`) | Per-day cap also applied to third-party declarations (COR-022 was keyed on `userId`, third-party rows have `userId=null`) |
| **DAT-035** | 3 | important | DAT-012 pre-flight (`c8b618e`) | `ProjectMember.role` institutional values — bailed in DAT-012 because `SELECT DISTINCT role` returned free-form FR labels, not codes; aligns with `[[project_responsable_scope_perimeter]]` (institutional roles vary per collectivité, only templateKey is stable) |
| **DAT-036** | 3 | important | DAT-016 closeout (`ce8877a`) | `Client.name` UNIQUE — named in DAT-016 Description ("Same for Client.name"), omitted from literal Suggested-fix |
| **COR-034** | 3 | nit | DAT-016 closeout (`ce8877a`) | Department/Service create: map P2002 → 409 (race-window past pre-check) |
| **DAT-037** | 3 | important | DAT-017 closeout (`f6ca325`) | Cross-table Task/Epic/Milestone `projectId` consistency trigger — the audit's discretionary "Consider trigger validating epic.projectId = task.projectId" (bidirectional) |
| **COR-035** | 3 | nit | DAT-017 closeout (`f6ca325`) | DTO cross-field guard — orphan task combination (`epicId`/`milestoneId` without `projectId`) returns 400 *before* the CHECK fires (lead fix), service-side 23514→BadRequest fallback |
| **DAT-038** | 3 | important | DAT-018 closeout (`fff93ce`) | `Event.parentEventId` cycle prevention — the audit's "Same for Event.parentEventId", named in Description AND Code evidence, omitted from literal Suggested-fix. Recipe = DAT-018's BEFORE-trigger + OLD-row exclusion (see Learnings #3) |
| **COR-037** | 3 | nit | DAT-023 closeout (`c27862a`) | Leave approve/import: map 23P01 → 409 — `approve` does NOT re-check overlap and module has no Prisma error filter, so EXCLUDE leaks as 500 on the TOCTOU race |
| **TOOL-DBSYNC-001** | 1 | important | DAT-003/004 bundle (`62c2fc4`) | Dev-DB `_dat005_backup_*` drift blocks `prisma migrate dev --create-only`; hand-author + `migrate deploy` is the workaround used throughout Phase 3 |

### Deliberately NOT filed (don't-file-phantoms discipline — record as anti-evidence)
- **COR-036** (would have been "trigger→500 leak on TaskDependency cycle") — service-layer `checkCircularDependency` returns 400 *before* any DB write, so the DAT-018 trigger only fires on direct-SQL bypass. No app-layer mapping needed. (See PROGRESS_LOG 2026-05-27 DAT-018 closeout.)
- **DAT-039** (would have been "widen DAT-023 partial WHERE for half-day") — pre-flight showed `checkOverlap` ignores `halfDay`, so morning+afternoon-same-day is *already* a conflict in product semantics, not a feature. The audit's literal `'[]'` bounds stand.

---

## Defense-in-depth sur `audit_logs` — 5 couches (inchangé)
1. **Immutability trigger** `audit_logs_no_update_delete` — `d6299cc`. UPDATE/DELETE → RAISE (SQLSTATE 23514).
2. **Hash chain** (`computeRowHash` + `prevHash`) — `d6299cc`. Recompute via `audit/recompute-chain.ts` (jamais ré-implémenter le hash).
3. **Actor snapshot** — `d6299cc`.
4. **Zod payload validation** `.strict()` + `schemaVersion` + GIN index — DAT-021 `33f7a9c`. Registre exhaustif ; rejet au INSERT avant hash.
5. **DB role REVOKE** — TOOL-DEPLOY-001 `8c37e1d`. `app_user` perd UPDATE/DELETE/TRUNCATE sur `audit_logs` (SQLSTATE 42501, en amont du trigger).

---

## Patterns infra récurrents établis (réutilisables Phase 3+)
- **Coherence gate** : multi-segment-aware (`[A-Z]+(?:-[A-Z]+)*-\d+`) + **anchor-commit pattern** pour closures rétroactives (empty commit portant `[closes <id>]`). Toute édition de `Closed_by` DOIT lire le script avant de prescrire un SHA.
- **Real-DB integration harness** (TST-DB-001) : DB éphémère + `prisma migrate deploy` + drop teardown. Cible `pnpm test:integration`, fichiers `*.int.spec.ts`. **Chemin de witness obligatoire pour CHECK/trigger/EXCLUDE.** Phase 3 a fait passer la suite intégration de 38 → **56** (DAT-017 +4, DAT-018 +7, DAT-023 +7).
- **Retroactive closure mechanism** : anchor commit `--allow-empty` nommant le SHA upstream.
- **Defense-in-depth** : invariant en code (DTO/Zod) PLUS au niveau DB.
- **Throwaway-DB witness pattern** : DB jetable créée+droppée dans la session.

---

## Prod deploy — STATUS

### Phase 1+2 baseline — ✅ DÉPLOYÉ (2026-05-26, vérifié terrain 2026-05-27)
| Élément | État prod vérifié |
|---|---|
| prod git HEAD | `3fd8986` |
| 4 migrations Prisma | `20260525190000_audit_logs_immutability…` (`d6299cc`), `20260525200000_dat007_project_fk…` (`0eae219`), `20260525210000_obs012_deployments…` (`189344f`), `20260526120000_dat021_audit_payload…` (`33f7a9c`) |
| `app_user` role + REVOKE | rôle créé ; privilèges `audit_logs` = `INSERT, SELECT` seulement |
| 2 scripts op | `normalize-action-codes` + `recompute-chain-on-schema-bump` exécutés, 0 legacy `PASSWORD_RESET_ADMIN`, schemaVersion 100% peuplé |
| `.env.production` | mis à jour, `APP_DATABASE_USER`/`APP_DATABASE_PASSWORD` ajoutés |

### Phase 3 batch — ⚠️ PENDING (NOT deployed)
**Prod HEAD reste `3fd8986`.** Master a accumulé **8 migrations Prisma + 1 changement code-only (COR-022)** depuis la baseline, **NOT YET deployed**:

| Migration | Task | SHA |
|---|---|---|
| `20260527120000_dat003_dat004_business_invariants` | DAT-003+004 | `62c2fc4` |
| _(code-only — no migration)_ | COR-022 | `760aa58` |
| `20260527130000_dat012_string_to_enum_promotions` | DAT-012 | `c8b618e` |
| `20260527140000_dat013_time_of_day_format_check` | DAT-013 | `c0189c1` |
| `20260527150000_dat014_leaves_type_autosync` | DAT-014 | `f8a5ce9` |
| `20260527160000_dat016_dept_service_unique` | DAT-016 | `ce8877a` |
| `20260527170000_dat017_task_parent_requires_project_check` | DAT-017 | `f6ca325` |
| `20260527180000_dat018_task_dependency_cycle_prevention` | DAT-018 | `fff93ce` |
| `20260527190000_dat023_leave_no_overlap_exclude` | DAT-023 | `c27862a` |

Deploy doc **seeded but not finalized** : `docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`. Le doc agrège les §pre-deploy probes / smoke / rollback de chaque task ; **TBD: markers** à remplir et **Migrations(8)/Scope counts à réconcilier** au moment du deploy (voir §Next).

---

## Deferred / non-bloquant
- **PERF-001** (Phase 2, TODO, stub différé) : fan-out d'émission audit par-document sur les endpoints list ; différé délibérément.

## Known pre-existing dette
- **ESLint 9.39.1 + ajv breakage** dans le job lint CI (conflit ajv/eslintrc). Rouge **avant** TOOL-COH-001 ; non touché, hors scope.
- **BUILD-001** (Phase 13, TODO) : `rootDir` structurel non pinné (workaround `exclude scripts/**` + `vitest.int.*` déployé).

---

## Process learnings — arc audit (original)
- **Constraints-not-prescriptions dans les prompts** : donner les invariants/le scope, laisser Claude dériver le mécanisme.
- **Pre-flight thorough** : grep-confirmer qu'une couche existe AVANT de filer une task (AUD-READ-001 d'abord BLOCKED — la presupposition était fausse).
- **Ground truth depuis serveur/code AVANT de prescrire un plan de deploy** : vérifier l'état réel.
- **Anchor commit pattern pour closures rétroactives** : empty anchor commit, jamais pointer `Closed_by` sur un fix upstream nommant une autre task.

## Process learnings — Phase 3 (nouveaux, 9)
1. **CHECK/regex = defense floor, not DTO equality.** La contrainte DB doit être un *superset* (jamais plus stricte) de la validation app-layer, sinon une entrée légitime côté app est rejetée par la DB (DAT-013 regex lenient ⊇ PredefinedTask DTO).
2. **Auto-sync vs validate-and-reject triggers.** Quand une colonne est une projection dérivée (service mappe codes non-enum → OTHER), utiliser un trigger d'auto-sync qui en fait un *read-only mirror* ; un trigger validate-and-reject rejetterait à tort la divergence légitime (DAT-014). Plus : `enum_range(NULL::"Type")` comme guard contre futurs membres d'enum dans la coercion.
3. **BEFORE INSERT/UPDATE self-traversal trigger sees the OLD row.** Une CTE récursive walking sa propre table doit exclure la ligne en cours d'UPDATE via `(TG_OP='INSERT' OR id <> OLD."id")` sur chaque branche de la CTE, sinon false-positive sur UPDATE-repoint. Détectable **uniquement** en intégration real-DB (pas unit/typecheck) — DAT-018. **Cette recette s'applique directement à DAT-037/DAT-038.**
4. **Prisma error-shape asymmetry.** `$executeRawUnsafe` *drop le nom de l'index* du 23505 (unique_violation) mais *préserve le nom de la contrainte* du 23514 (check_violation). Asserter les witnesses UNIQUE sur le tuple `Key (<cols>)=`, les witnesses CHECK sur le nom de contrainte (DAT-016).
5. **Hand-authored byte-equivalent migration.** Quand `migrate dev --create-only` est drift-blocked (TOOL-DBSYNC-001), hand-author la migration pour matcher exactement la sortie de migrate dev (convention Prisma index/constraint naming) et appliquer via `migrate deploy` (DAT-016 pour DSL-expressible ; DAT-003/004/013/014/017/018/023 étaient raw-SQL-only de toute façon).
6. **DSL-expressibility split.** CHECK / triggers / EXCLUDE sont raw-SQL-only, `schema.prisma` *untouched* ; UNIQUE / FK / enum-promotion sont Prisma-DSL-expressible, `schema.prisma` *édité*. Détermine per-task si `schema.prisma` change.
7. **Layer-of-rejection discipline.** Race-window-after-pre-check → catch P2002/23P01 → 409 (COR-034/037) ; pre-checkless plainly-invalid input → DTO-side 400 (COR-035). Chaque couche rejette ce qui est *sa* responsabilité.
8. **Audit-literal validation.** Le pre-flight vérifie que le SQL littéral de l'audit est correct pour CE codebase (DAT-023 a confirmé que `'[]'` bounds, partial WHERE, no `::date` cast sont tous corrects en inspectant `checkOverlap` + le schema `@db.Date`) plutôt que blind-follow OU sur-interpréter. Ni l'un ni l'autre des extrêmes : vérifier.
9. **Don't-file-phantoms (inverse du closeout-filing).** Quand le pre-flight prouve qu'une adjacency ne leak pas vraiment OU que le littéral couvre déjà le cas, NE PAS filer un follow-up (COR-036, DAT-039 non-filings).

---

## Next session — META-WORK puis décision d'arc

**Stop signal de la session DAT-023 : « DO NOT auto-continue to Phase 4. »** La phase 3 audit-prescribed est close ; les deux next-steps sont du *meta-work* avant tout pickup task.

### Immediate meta (en séquence)
1. **Deploy-doc finalize** (`docs/deploy/2026-05-2x-phase-3-defense-in-depth-deploy.md`) :
   - Remplir les **TBD: markers**.
   - Réconcilier les counts (header dit "Migrations(8)" — vérifier que toutes les sub-tables / IN-lists / Scope rows sont cohérentes à 8).
   - Extraire un **checklist pre-deploy cumulatif ordonné** rassemblant les §pre-deploy disséminées : notamment **DAT-012 `SELECT DISTINCT`** (vérifier que les enum-promoted columns ne contiennent que des codes valides), **DAT-023 overlap-pair scan + btree_gist superuser** (l'extension nécessite superuser pour `CREATE EXTENSION` sur prod), et les **per-CHECK violator scans** (DAT-003/004/013).
2. **Prod deploy effectif** des 8 migrations + 1 code-only — décision opérateur sur la fenêtre (alignée avec dispo + comm CPAM 92). Le doc finalisé pilote l'exécution.

### Then — décision d'arc à SURFACER (ne pas trancher dans la doc)
Deux trajectoires acceptables, à présenter à l'utilisateur :

- **(A) "Phase 3 defense-in-depth completion" mini-arc** — clore d'abord les 10 follow-ups Phase-3-tagged (DAT-032/033/034/035/036/037/038, COR-034/035/037). **Tradeoff :** garde la phase cohérente pour la narration Cour des Comptes ("Phase 3 = invariants métier au niveau DB, fully closed") avant de bouger en Phase 4.
- **(B) Phase 4 (RBAC complétude, 6 tasks)** per phase ordering — Phase 4 a priorité de séquence selon l'ordre des phases. **Tradeoff :** avance la breadth de l'audit, mais laisse 10 TODO Phase-3-tagged ouverts.

**Flags d'implémentation** quand l'arc est choisi :
- DAT-037 et DAT-038 portent directement la recette du Learning #3 (BEFORE-trigger OLD-row exclusion). Le risque "false-positive UPDATE" se reproduit textuellement ; test UPDATE-positive obligatoire.
- COR-034/035/037 partagent le pattern Learning #7 (race-window 409 vs plainly-invalid 400). Chacune a une variante différente : COR-034 pure P2002 (DAT-016 unique), COR-035 *DTO-side 400 lead* + service-side 23514 fallback (DAT-017), COR-037 pure 23P01 (DAT-023). Ne pas copier-coller un seul handler générique sans valider lequel s'applique.
- DAT-033 contient explicitement le TOCTOU residual relevé en clôture de COR-022 (cf. commit `44b6a1f`) — pas une nouvelle question, déjà cadrée.

---

## Invocation prompt for fresh Claude session
```
exécute le prompt du fichier handover en KB
```
