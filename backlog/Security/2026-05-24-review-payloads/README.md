# ORCHESTRA Security Audit Remediation Bundle

This directory contains a complete remediation backlog for the 2026-05-24 ORCHESTRA security audit.

## Directory structure

```
backlog/Security/
├── README.md                                 (this file)
├── BACKLOG.md                                Main artifact — 174 tasks, source of truth for Claude Code execution
├── CLAUDE_SESSION_CONTRACT.md                Protocol Claude Code must follow per fresh session
├── PROGRESS_LOG.md                           Append-only session journal (initially empty)
├── audits/
│   ├── 2026-05-24-adversarial-review.md      Executive summary + cluster analysis (human-readable)
│   ├── findings.json                         All 173 audit findings, combined array
│   ├── codex-addendum.json                   Codex cross-review finding #174
│   └── agents/
│       ├── 01-security.json
│       ├── 02-correctness.json
│       ├── 03-data-integrity.json
│       ├── 04-performance.json
│       ├── 05-observability.json
│       └── 06-tests.json
├── scripts/
│   └── check-backlog-coherence.sh            CI gate — enforces Closed_by SHA presence on DONE tasks
└── .github/workflows/
    └── backlog-coherence.yml                 GitHub Actions wrapper for the CI gate
```

## Usage

### First session
1. Read `CLAUDE_SESSION_CONTRACT.md` end-to-end.
2. Read `BACKLOG.md` schema legend + Totals + Cross-validated subset table.
3. Pick the first Phase 1 task (recommendation: `SEC-001`, cross-validated and at the top of the deny-list for production safety).

### Every subsequent session
Apply the protocol in `CLAUDE_SESSION_CONTRACT.md`. One task per session, never auto-continue.

### CI integration
`scripts/check-backlog-coherence.sh` runs in GitHub Actions on every PR touching `BACKLOG.md`. It blocks PRs where DONE tasks have empty/invalid `Closed_by` SHAs or where the commit message does not contain `[closes <task-id>]`.

## Phase distribution

| Phase | Cluster | Title | Tasks |
| --- | --- | --- | ---: |
| 1 | mixed | Stop the bleed (audit-prescribed blockers) | 7 |
| 2 | A | Cour des Comptes — Audit log durcissement | 16 |
| 3 | F | Defense-in-depth schema — Invariants métier en SQL | 10 |
| 4 | B | RBAC complétude | 6 |
| 5 | K | Auth defense-in-depth | 12 |
| 6 | J | Upload / URL sinks | 8 |
| 7 | D | Mutations atomicity | 8 |
| 8 | C | Date / TZ unification | 7 |
| 9 | E | Hot paths : indexes + N+1 | 17 |
| 10 | G | Cascade vs conservation | 5 |
| 11 | H | Tests : suppression du théâtre | 12 |
| 12 | I | Frontend : couche données partagée | 7 |
| 13 | — | Findings hors cluster (parallèle) | 59 |
| **Total** | | | **174** |

## Cross-validated subset (highest confidence)

The following 7 findings were independently flagged by both Claude Code's adversarial review and OpenAI Codex's cross-review. Defensible to a Cour des Comptes auditor as not-an-hallucination. Within their phase, prioritize these first.

- `SEC-001` — RBAC guard defaults to permissive mode
- `OBS-001` — Security audit events go to console only
- `DAT-001` — Leave.approve() updates status outside transaction and audit is logger-only
- `DAT-002` — AuditService is logger-only — security events not persisted
- `DAT-007` — Hard-delete of a Project nukes its TimeEntries, ProjectSnapshots, Documents
- `PER-003` — Daily snapshot cron N+1: findFirst per project then create
- `PER-010` — Leave model has ZERO indexes — every leaves query is a seq scan

## Conventions

- **Source files are read-only.** `audits/2026-05-24-adversarial-review.md`, `audits/findings.json`, `audits/agents/*.json`, and `audits/codex-addendum.json` are immutable source of truth. The BACKLOG.md is the workbench; the audit files are the spec.
- **One task = one commit minimum.** The closing commit message must contain `[closes <task-id>]`. The CI gate enforces this mechanically.
- **No phase skipping.** Phase N+1 picks are only allowed when phase N is fully drained (or for phase 13 isolated findings, which can be picked alongside any phase).
- **Verification is a contract.** Tasks marked DONE without the verification command passing are violations.

## Generated metadata

- Generated: 2026-05-24
- Source audit run: 2026-05-24 (6 parallel adversarial sub-agents + Codex cross-review)
- Total findings: 173 + 1 Codex addendum = 174
