# RUN MANIFEST — full-backlog Dynamic Workflow (2026-06-03 → 2026-06-04)

Authoritative: git `[closes <id>]` commits + `scripts/check-backlog-coherence.sh` (green). 231 commits this run.

## Tally
- **FOLDED: 114**
- FAILED (honest non-close): 8
- MANUAL follow-up: 1
- HALTED (operator decision): 2
- SKIPPED (time-gate): 1
- **Total: 126 / 126 TODO**

## Final gate
- `pnpm build` ✅  `pnpm test` ✅ (whole tree, after all folds) · coherence gate ✅ · schema drift probe: empty
- `lint` EXCLUDED run-wide: ESLint 9.39.1 + @eslint/eslintrc ajv crash on master (pre-existing tooling breakage, not a code property)

## FAILED — honest non-closes (left TODO)
- **COR-011** — already fixed by PER-006 (findAll shape); reverting to force a RED = theater
- **COR-025** — non-defect: targetUserId===self confers no privilege bypass (no RED possible)
- **COR-033** — non-defect: canEdit/canDelete asymmetry is intentional + backend-enforced
- **DAT-019** — append-only: migration applied 2026-04-20 cannot be retro-wrapped; AC2 RED→GREEN undemonstrable
- **DAT-020** — missing ops GPG key + off-host bucket (not in repo); PII backups; prior attempt 891448a was reverted
- **DAT-027** — already fixed by DAT-011 + PER-012 (Event indexes present)
- **TST-019** — test-quality refactor only (DTOs validated, ValidationPipe configured) — no behavioral anchor for a RED
- **TST-021** — negative 403 coverage already systematic in the RBAC permission-matrix; duplication = theater

## MANUAL follow-up (real issue, fix out of task scope)
- **SEC-016** — REAL vuln (anon GET /api/uploads/* = 200), but prescribed main.ts fix cannot work for <img> (no Bearer header). Real fix = authenticated avatar route + UserAvatar blob-loading (multi-file frontend+route) — outside the task contract. Left TODO, flagged.

## HALTED — awaiting operator compliance decision
- **DAT-008** — OPERATOR compliance decision — leave/time-entry retention on user delete; spec under-specifies (a) PII fields anonymized vs kept, (b) retention window, (c) reversibility (offers 2 forks). HALTED, not auto-decided.
- **DAT-026** — OPERATOR compliance decision — user soft-delete + RGPD anonymization; spec under-specifies (a) PII fields, (b) retention window, (c) when/if irreversible. HALTED, not auto-decided.

## SKIPPED
- **SEC-014-CLEANUP** — time-gate — earliest 2026-06-07 (one JWT_REFRESH_TTL after SEC-014 prod deploy 2026-05-31)

## Caveats / recorded decisions
- **e2e folds** (TST-003/004/005/007/013/014/015/E2E-001/024) verified via STRUCTURAL witnesses (skip/tautology removed, `playwright --list` compiles). Runtime e2e is OPERATOR-verified — no browser boot in this LOCAL run.
- **SEC-CSP-001** (785e661) needs BROWSER white-screen QA before any deploy (LOCAL build + CSP-header unit test only).
- **Foundation hygiene** (no [closes]): GIN PSL declaration 7eb646d (stops migrate-dev drift); *.tsbuildinfo gitignore 90c9fb6.
- **DAT-005 backup retirement** migration 20260603120000 will drop the prod backup tables on the operator's NEXT migrate deploy.
- **Schema chain**: 17 schema migrations folded on LOCAL dev only; prod is behind by all this run's migrations + missing per011/012/013 — prod sync is a SEPARATE authorized task (NOT done here).
- **PROD INCIDENT (2026-06-03, separately reported + remediated)**: 4 workers auto-deployed to prod off the old deploy-memory; prod assessed read-only (13 deleted rows were true dups, dropped backups redundant, migration ledger consistent, no PITR). Root cause neutralized: feedback_orchestra_push_and_deploy rewritten LOCAL-ONLY + non-overridable worker fence + project_prod_server_access use-policy.

## FOLDED (114) — task → fix SHA
- BUILD-001 → e77da66e
- COR-004 → bf5cf483
- COR-005 → e7a39227
- COR-006 → f4ab084c
- COR-007 → b3498c74
- COR-008 → 0c5bc442
- COR-009 → 387b1df6
- COR-010 → 8f44239c
- COR-012 → 2947cbad
- COR-013 → a3e37b16
- COR-014 → 63387970
- COR-015 → 47151a00
- COR-016 → 34291b70
- COR-017 → a1065136
- COR-018 → ee536625
- COR-019 → e822fe51
- COR-020 → 72028346
- COR-021 → 506684b2
- COR-023 → 576f4287
- COR-024 → 66eb6b7a
- COR-026 → 1932c331
- COR-027 → a5713225
- COR-029 → 0ec880a7
- COR-030 → 29de2954
- COR-031 → 63d1c48e
- COR-032 → bedcb204
- DAT-006 → ccf084f1
- DAT-010 → 5400b373
- DAT-011 → 68da3b92
- DAT-015 → e9dc6953
- DAT-022 → 0ac82e3b
- DAT-024 → 7490705f
- DAT-025 → a87006f6
- DAT-028 → 1f0e32ab
- DAT-029 → 25a17322
- DAT-030 → 5a789e20
- DAT-031 → 13d91539
- OBS-009 → 7b448c13
- OBS-010 → 5a4bd54e
- OBS-011 → 70f0ac11
- OBS-014 → e7526cbb
- OBS-015 → 969eba4a
- OBS-016 → 3395fd73
- OBS-017 → 07409128
- OBS-019 → 73582574
- OBS-022 → eea71f67
- OBS-023 → 0a78cc64
- OBS-025 → 0fd4ee6a
- PER-001 → ebd86dbf
- PER-002 → 00c7efd5
- PER-003 → f818fc03
- PER-004 → db78d739
- PER-005 → 4f87c7f7
- PER-006 → 4b2fd004
- PER-007 → 40eae79a
- PER-008 → 1fd56d4a
- PER-009 → 818a2907
- PER-010 → 499143c3
- PER-011 → 129da90b
- PER-012 → f23310ed
- PER-013 → 55490e6b
- PER-014 → 15e9c873
- PER-015 → 40206350
- PER-016 → 7a522a5c
- PER-017 → 4732c93f
- PER-018 → 0145924d
- PER-019 → af121275
- PER-020 → c5204ac9
- PER-021 → 4d5206a7
- PER-022 → 749af300
- PER-023 → 614683c2
- PER-024 → f643cdd1
- PER-025 → f827699b
- PER-026 → e62ad89c
- PER-027 → c4d6328e
- PER-028 → 994c6b80
- PER-029 → f757f81c
- PER-030 → 9aa11720
- PERF-001 → 64f5c907
- SEC-008 → ce82cbe9
- SEC-012 → b4b82d8e
- SEC-017 → 37133f8f
- SEC-018 → a3597d00
- SEC-020 → 6d361b93
- SEC-024 → 04b4c159
- SEC-025 → bcfa26b3
- SEC-026 → 9c0cb8d6
- SEC-027 → d5ae7ae3
- SEC-028 → 24550641
- SEC-029 → 38d6beaa
- SEC-CSP-001 → 785e6617
- SEC-FE-001 → eaed8f5d
- TOOL-DBSYNC-001 → 07cc23b3
- TST-002 → 5592346e
- TST-003 → 9b1085bb
- TST-004 → 35a3c3cc
- TST-005 → 2e871dde
- TST-006 → 6953e689
- TST-007 → b2cf230f
- TST-008 → a8fae7f5
- TST-009 → 2cc1b7b8
- TST-010 → 3980b804
- TST-012 → 7d051d82
- TST-013 → 2ad616bf
- TST-014 → 3afa52e9
- TST-015 → 1bb5497d
- TST-016 → aedd4022
- TST-017 → 28dc49a5
- TST-020 → 9bcd44bb
- TST-022 → 1ff2ec17
- TST-023 → 1cea2065
- TST-024 → 15ad2cf9
- TST-025 → 69dc1549
- TST-E2E-001 → c05212cd
