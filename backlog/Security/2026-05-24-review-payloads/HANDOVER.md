# ORCHESTRA Audit Remediation — Session Handover (Phase 3 readiness)

## Contexte projet
Repo: /home/alex/Documents/REPO/ORCHESTRA (NestJS + Prisma + Next.js monorepo)
User: Alexandre, DSI CPAM 92. Audit Cour des Comptes window S1 2026.
Communication: French (user). Code/docs en English.
Stack prod: VPS 92.222.35.25 (debian@), Docker Compose, PostgreSQL 18, accès SSH via ~/.ssh/id_ed25519, repo prod à /opt/orchestra. Container DB = postgres service (orchestr-a-postgres-prod), DB=orchestr_a_prod, user=orchestr_a. Prod runs UTC.

Discipline obligatoire: lire `CLAUDE_SESSION_CONTRACT.md` EN PREMIER. Pattern par task: IN_PROGRESS commit AVANT code → fix commit `[closes X]` → BACKLOG (DONE + Closed_by) + PROGRESS_LOG closeout. Master-only (pas de PR). `scripts/check-backlog-coherence.sh` = gate (DONE ⇒ SHA + `[closes X]` dans le commit).

---

## Current state (master @ 3fd8986, working tree clean)

### Phase 1 — blockers audit-prescribed : 7/7 DONE + déployés prod (2026-05-25)
SEC-001 `507d755`, SEC-002 `24bbfe7`, SEC-003 `2763552`, DAT-001 `b14cdd5`, DAT-005 `bcb7ec3`, COR-003 `8fc6c92`, CLAUDE-CFG-001 `a4c3ec2`. Audit-trail: `docs/deploy/2026-05-25-phase-1-remediation-deploy.md`.

> **Prod git HEAD = `3fd8986`** (= master courant, vérifié sur le VPS 2026-05-27). La prod est à jour pour le code+schéma jusqu'à TOOL-DEPLOY-001 inclus.

### Phase 1 — tooling : 5/5 DONE (déployé prod 2026-05-26, voir § deploy)
| Task | Closed_by | Origine | Nature (≠ stub — substantiel) |
|---|---|---|---|
| CLAUDE-CFG-001 | `a4c3ec2` | audit (codex-only) | config repo |
| TOOL-COH-001 | `e6b836c` | session-derived | coherence gate : regex multi-segment `[A-Z]+(?:-[A-Z]+)*-\d+` |
| TOOL-COH-002 | `e6b836c` | session-derived | formalisation du pattern anchor-commit (doc) |
| TST-DB-001 | `e30292c` | session-derived | harness d'intégration real-DB (`vitest.int.config.ts`, `pnpm test:integration`) |
| TOOL-DEPLOY-001 | `8c37e1d` | session-derived | split rôle DB app_user/owner + `directUrl` + `init-roles.sql` |

### Phase 2 — Cour des Comptes audit-log durcissement : 20/21 DONE (PERF-001 le seul stub différé)
**16 audit-sourced :** DAT-002 `c62ac8d`, OBS-001 `1ff6c9a`, OBS-002 `d6299cc`, OBS-003 `1aa24b5`, OBS-004 `330a8eb`, OBS-005 `ec88cc9`, OBS-006 `4bee971`, OBS-007 `4711097`, OBS-012 `189344f`, OBS-018 `986c06f`, OBS-020 `bfc7a78`, OBS-021 `c45f209`, OBS-024 `7393b5d`, DAT-009 `d6299cc`, DAT-021 `33f7a9c`, TST-011 `870cd81`.
**4 session-derived (filings nés pendant l'arc, vérifiés via le champ Source) :** AUD-EMIT-001 `ffc4cf4`, OBS-026 `a42d663`, USR-DEL-001 `950068f`, AUD-READ-001 `5f87026`.

> ⚠️ Le header BACKLOG lit encore *« 19 tasks in this phase »* — **stale**, antérieur aux 4 ajouts session-derived. Le décompte réel est 20 DONE + PERF-001. Ne pas se fier au header.

### DAT-007 (Phase 10) — DONE `0eae219`, pickup hors-phase
Pris hors séquence pendant l'arc audit (FK `Task.projectId` Cascade → Restrict, préserve l'historique). Sert de pattern-mirror direct pour USR-DEL-001. Sa migration fait partie du batch deploy en attente (voir plus bas). **Le reste de Phase 10 (DAT-008/022/025/026) est TODO** — ne pas y toucher avant Phase 3 close.

---

## Defense-in-depth sur `audit_logs` — 5 couches
1. **Immutability trigger** `audit_logs_no_update_delete` / fn `audit_logs_immutable()` — `d6299cc` (migration `20260525190000`). UPDATE/DELETE → RAISE `/append-only/` (SQLSTATE 23514).
2. **Hash chain** (`computeRowHash` + `prevHash`) — `d6299cc`. Exporté pour vérification externe ; recompute via `audit/recompute-chain.ts` (jamais ré-implémenter le hash).
3. **Actor snapshot** (identité de l'acteur figée dans la row) — `d6299cc`.
4. **Zod payload validation** `.strict()` + `schemaVersion` + GIN index — DAT-021 `33f7a9c`. Registre exhaustif `Record<AuditAction, ZodTypeAny>` ; rejet au INSERT avant hash.
5. **DB role REVOKE** — TOOL-DEPLOY-001 `8c37e1d` (`init-roles.sql`). `app_user` perd UPDATE/DELETE/TRUNCATE sur `audit_logs` (SQLSTATE 42501, en amont du trigger) ; seul le rôle owner/migration peut muter (chemin de maintenance détectable par la chaîne de hash).

---

## Patterns infra récurrents établis (réutilisables Phase 3+)
- **Coherence gate** : multi-segment-aware (`[A-Z]+(?:-[A-Z]+)*-\d+`) + **anchor-commit pattern** pour closures rétroactives (empty commit portant `[closes <id>]`, `Closed_by` pointe dessus — voir `CLAUDE_SESSION_CONTRACT.md` § Retroactive closures). Toute édition de `Closed_by` DOIT lire le script avant de prescrire un SHA.
- **Real-DB integration harness** (TST-DB-001) : DB éphémère sur un Postgres fourni + `prisma migrate deploy` + drop au teardown. Cible `pnpm test:integration`, fichiers `*.int.spec.ts`. C'est le chemin pour prouver triggers/FK/CHECK contre un vrai Postgres — **directement pertinent pour Phase 3** (les CHECK constraints SQL ont besoin d'un witness real-DB, pas mock).
- **Retroactive closure mechanism** : anchor commit `--allow-empty` nommant le SHA upstream (ex. OBS-008 `2188b3d` ↔ matériel `1ff6c9a` ; OBS-020 `bfc7a78`).
- **Defense-in-depth** : invariant en code (DTO/Zod) PLUS au niveau DB. C'est exactement le thème de Phase 3.
- **Throwaway-DB witness pattern** : pour valider une migration/recompute sans polluer la trail dev immuable — DB jetable créée+droppée dans la session (précédents AUD-READ-001, DAT-021).

---

## Prod deploy — STATUS : ✅ DÉPLOYÉ (2026-05-26, vérifié terrain 2026-05-27)
Le batch a été exécuté en fin de session précédente (2026-05-26 ~21:00–21:18). Vérifié directement sur le VPS le 2026-05-27. **Tout est en place et sain :**

| Élément du batch | État prod vérifié |
|---|---|
| prod git HEAD | `3fd8986` (master courant) |
| **4 migrations Prisma** appliquées (`_prisma_migrations`) | `20260525190000_audit_logs_immutability…` (`d6299cc`), `20260525200000_dat007_project_fk…` (`0eae219`), `20260525210000_obs012_deployments…` (`189344f`), `20260526120000_dat021_audit_payload…` (`33f7a9c`) |
| **`app_user` role + REVOKE** (`init-roles.sql`) | rôle créé ; privilèges sur `audit_logs` = `INSERT, SELECT` seulement (REVOKE UPDATE/DELETE/TRUNCATE effectif) |
| **2 scripts op** (`normalize-action-codes`, `recompute-chain-on-schema-bump`) | exécutés — 5 paires `SYSTEM_BACKFILL` STARTED/COMPLETED propres (21:15→21:18), 0 row legacy `PASSWORD_RESET_ADMIN`, `schemaVersion` peuplé 100% (0 null / 28 rows) |
| **`.env.production`** | mis à jour 2026-05-26 21:06 — `APP_DATABASE_USER`/`APP_DATABASE_PASSWORD` ajoutés (le compose dérive l'URL app-role à partir de ces vars ; backup `.bak-20260526-210337` conservé) |

> Note 1 : **4 migrations, pas 5** (le batch a parfois été décrit « 5 » de mémoire — la vérité git/prod est 4).
> Note 2 : **lacune process** — ce batch n'a PAS de deploy doc (seul Phase 1 en a un). Les closeouts PROGRESS_LOG disent « no deploy » car écrits *avant* l'opération batch ; ne pas s'y fier pour l'état prod. **Pour Phase 3 : produire un `docs/deploy/2026-05-2x-phase-3-…md` au moment du deploy.**
> Note 3 : la mémoire `[[project_prod_behind_master_dat005]]` (« prod HEAD=8e4b593 ») est périmée — corrigée en session.

**→ Rien en attente de deploy. Phase 3 démarre sur une prod alignée.**

---

## Deferred / non-bloquant
- **PERF-001** (Phase 2, TODO, stub différé) : fan-out d'émission audit par-document sur les endpoints list ; à implémenter (queue/batch) quand le volume de `LOGIN_SUCCESS` deviendra une préoccupation perf. **Pas un gap** — différé délibérément.

## Known pre-existing dette
- **ESLint 9.39.1 + ajv breakage** dans le job lint CI (conflit ajv/eslintrc). Rouge **avant** TOOL-COH-001 ; non touché, hors scope de l'arc audit. Ne pas confondre avec une régression introduite par la remédiation.
- **BUILD-001** (Phase 13, TODO) : `rootDir` structurel non pinné (workaround `exclude scripts/**` + `vitest.int.*` déployé). Gotcha connu : ajouter un fichier hors `src/` décale `dist/main.js`.

## Process learnings de cet arc
- **Constraints-not-prescriptions dans les prompts** : donner les invariants/le scope, laisser Claude dériver le mécanisme (ex. TST-DB-001 option (b) vs testcontainers décidé par les contraintes repo).
- **Pre-flight thorough** : grep-confirmer qu'une couche existe AVANT de filer une task (AUD-READ-001 d'abord BLOCKED car aucune read pipeline à aliaser — la presupposition était fausse).
- **Ground truth depuis serveur/code AVANT de prescrire un plan de deploy** : vérifier l'état réel (migrations en prod, rôles DB, env) plutôt que supposer.
- **Anchor commit pattern pour closures rétroactives** : ne jamais pointer `Closed_by` sur un fix upstream qui nomme une AUTRE task (schema-naive, échoue le gate) — utiliser un empty anchor commit.

---

## Next session : Phase 3 — Defense-in-depth schema — Invariants métier en SQL
Phase 3 (10 tasks, BACKLOG l.1715) descend les invariants métier au niveau DB en CHECK/UNIQUE/EXCLUDE constraints (defense-in-depth — aujourd'hui dupliqués seulement en DTO/Zod, contournables si le service est bypassé). Couvre : CHECK dates (DAT-003), CHECK bornes numériques (DAT-004), cap heures TimeEntry (COR-022), enum vs free-string (DAT-012), TIME vs String (DAT-013), legacy `Leave.type` (DAT-014), UNIQUE Department/Service name (DAT-016), orphan tasks (DAT-017), cycle TaskDependency (DAT-018), overlap leaves EXCLUDE gist (DAT-023).

**Ordre de pickup** : les 10 sont **toutes** `claude-only`, Cluster **F** — **il n'y a AUCUNE task cross-validated ni Cluster A en Phase 3** (ne pas perdre un tour à les chercher). Le filtre tombe donc sur la sévérité : commencer par les 2 **blocking** — **DAT-003** puis **DAT-004** — avant les 8 **important**. **Aucun pick Phase N>3 tant que Phase 3 n'est pas entièrement close** (DAT-007 a été un pickup hors-phase exceptionnel déjà fait ; ne pas reproduire).

Le real-DB harness (TST-DB-001, `*.int.spec.ts`) est le chemin de witness pour les CHECK constraints : FAIL-pre (INSERT invalide accepté) → PASS-post (rejeté par la contrainte). Préférer ça au mock pour Phase 3.

---

## Invocation prompt for fresh Claude session
```
exécute le prompt du fichier handover en KB
```
