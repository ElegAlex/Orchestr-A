#!/usr/bin/env python3
"""
build-merged-backlog.py — deterministically reconcile the two 2026-06-04 adversarial
audit runs into ONE prioritized remediation backlog (BACKLOG.md).

Inputs (repo-relative):
  audits/2026-06-04-adversarial-review/findings.json            (268, "primary" — optimized run)
  audits/2026-06-04-adversarial-review-sessionA/findings.json   ( 99, "sessionA" — earlier run)
  audits/2026-06-04-adversarial-review/SEC-001-prod-verification.md  (live correction, already
                                                                       folded into primary SEC-001)

Output:
  backlog/Security/2026-06-04-adversarial-review/BACKLOG.md

Reconciliation rules (curated by hand, applied deterministically here):
  * DEDUP across runs on (file + root cause). Primary is canonical (it went through the
    adversarial refutation wave). A sessionA finding that duplicates a primary one is folded
    into the primary entry as a cross-link; it is NOT emitted as its own task.
  * sessionA-only findings ARE emitted, with IDs namespaced `SA-<orig-id>` so they never
    collide with a primary ID in the same file.
  * Severity recalibration: blocking ratings whose TRUTH depends on runtime/deploy/CI/live
    state are capped at `important` and tagged `requires-live-verification` (Phase 3).
    Code-verifiable blockers stay blocking (Phase 1).
  * Prioritized phases: 1 code-verifiable blockers, 2 important (code-verifiable),
    3 requires-live-verification (capped, pending a live check), 4 nit, 5 suggestion.
"""
import json, re, sys
from pathlib import Path
from collections import defaultdict, Counter

ROOT = Path(__file__).resolve().parents[4]               # repo root
AUD = ROOT / "audits"
PRIMARY = json.loads((AUD / "2026-06-04-adversarial-review" / "findings.json").read_text())
SESSA   = json.loads((AUD / "2026-06-04-adversarial-review-sessionA" / "findings.json").read_text())
OUT = ROOT / "backlog/Security/2026-06-04-adversarial-review/BACKLOG.md"

PRIMARY_SRC = "audits/2026-06-04-adversarial-review/findings.json"
SESSA_SRC   = "audits/2026-06-04-adversarial-review-sessionA/findings.json"

# ── DEDUP MAP: sessionA finding id  ->  canonical primary id it duplicates ──────────────
# (curated from a same-file + same-root-cause review; see PROGRESS notes in BACKLOG header)
DUP = {
    "SEC-001": "SEC-028",  # admin reset-password does not bump nbf
    "SEC-002": "COR-039",  # self-service changePassword does not bump nbf
    "SEC-003": "SEC-003",  # LoginDto missing @MaxLength (bcrypt DoS)
    "SEC-005": "SEC-005",  # comment DTO content missing @MaxLength
    "SEC-006": "SEC-047",  # project DTO description/* missing @MaxLength
    "SEC-007": "SEC-019",  # task DTO description/tags missing validators
    "SEC-008": "SEC-042",  # leave DTO reason/* missing @MaxLength
    "SEC-011": "SEC-011",  # metrics token non-constant-time compare
    "SEC-013": "SEC-033",  # nginx no HSTS (+ no http->https redirect; relate SEC-001)
    "SEC-015": "SEC-032",  # nginx forwards client X-Forwarded-Proto
    "COR-001": "COR-023",  # captureSnapshots local-TZ midnight
    "COR-002": "COR-040",  # users.update membership writes outside tx
    "COR-003": "COR-007",  # auth.resetPassword non-atomic token consume
    "COR-005": "COR-019",  # personal-todos 20-item TOCTOU
    "COR-006": "COR-016",  # getLeaveBalance host-TZ getFullYear
    "COR-007": "PER-007",  # importLeaves work inside tx loop (also nested-tx correctness)
    "COR-010": "COR-001",  # canValidate delegation bypass  ★ cross-validates the headline blocker
    "DAT-001": "DAT-002",  # TaskRACI.userId no FK            ★ cross-validates a blocker
    "PERF-002": "COR-062", # tasks.findAll 1000 cap
    "PERF-003": "PER-021", # getTasksByProject unbounded
    "PERF-004": "PER-021", # getTasksByAssignee unbounded
    "PERF-005": "PER-025", # findOrphans unbounded
    "PERF-006": "PER-022", # getMyDoneUndeclaredTasks unbounded
    "PERF-007": "PER-024", # importTasks sequential writes
    "PERF-008": "PER-030", # importUsers sequential writes
    "PERF-009": "PER-023", # checkCircularDependency BFS N+1
    "PERF-010": "PER-001", # analytics.getTasks unbounded/over-fetch
    "PERF-016": "PER-016", # getProjectStats full members
    "PERF-019": "PER-051", # captureSnapshots loads all tasks
    "PERF-020": "PER-035", # TaskDependency.dependsOnTaskId no index
    "PERF-021": "PER-036", # TaskRACI.userId no index
    "PERF-022": "PER-041", # comments.findAll 1000 cap
    "OBS-001": "OBS-017",  # UsersService.create emits no audit row
    "OBS-002": "OBS-016",  # importUsers bulk emits no audit rows
    "OBS-006": "OBS-021",  # generateResetToken logs PASSWORD_CHANGED
    "OBS-007": "OBS-005",  # Sentry/error-reporter no-op stub
    "TEST-016": "TST-010", # balance-gating mutation witness skipped by default
    "TEST-017": "TST-009", # uploads-auth preflight test .not.toBe(401)
}

# ── SEVERITY RECALIBRATION ──────────────────────────────────────────────────────────────
# requires-live-verification: truth/severity depends on runtime/deploy/CI/live state and is
# NOT provable from the repo alone. Capped at `important`, routed to Phase 3.
LIVE_PRIMARY = {
    "SEC-001",  # TLS edge terminated by out-of-repo host nginx (IaC drift); HSTS absent; weak ssl_protocols floor
    "SEC-002",  # CI e2e jobs boot API w/o AUDIT_HASH_KEY -> assertAuditHashKey aborts (CI-runtime)
    "SEC-032",  # nginx X-Forwarded-Proto trust depends on the real out-of-repo edge
    "SEC-033",  # HSTS presence depends on the live edge (relates SEC-001)
    "SEC-063",  # X-Frame-Options vs frame-ancestors: effective header depends on the live edge
    "SEC-064",  # nginx rate-limit coverage on the live edge is not provable from the inner conf
    "OBS-001",  # blocking->important: "API cannot boot in E2E" is a CI-runtime claim
    "TST-001",  # blocking->important: matrix-contradiction realized only when the e2e suite runs
    "COR-023",  # snapshot local-TZ dedup: blocking impact is deploy-TZ-conditional (masked on UTC prod)
    "DAT-014",  # CREATE INDEX without CONCURRENTLY: prod-lock impact depends on live table size/traffic
}
# sessionA-only findings whose truth is live/deploy-dependent — keyed by the NAMESPACED
# `SA-<id>` (build_entry sets canonical_id = "SA-"+orig for sessionA entries; bare ids here
# would wrongly match the primary run's same-numbered — and unrelated — findings).
LIVE_SESSA = {
    "SA-SEC-014",  # docker-compose.prod.yml deprecated ALLOWED_ORIGINS -> prod CORS behavior
    "SA-SEC-018",  # .env.production.example: effective prod access-token TTL (7d) depends on prod env
    "SA-OBS-013",  # AUDIT_HASH_KEY absent from prod env template -> prod boot/provisioning
}

SEV_RANK = {"blocking": 0, "important": 1, "nit": 2, "suggestion": 3}

# invert DUP: canonical primary id -> [sessionA ids folded in]
folded = defaultdict(list)
for sa_id, p_id in DUP.items():
    folded[p_id].append(sa_id)

duped_primary_ids = set(DUP.values())
sessa_dup_ids = set(DUP.keys())


def eff_severity(orig_id, sev, is_live):
    if is_live and sev == "blocking":
        return "important"
    return sev


def phase_of(eff_sev, is_live):
    if is_live:
        return 3
    if eff_sev == "blocking":
        return 1
    if eff_sev == "important":
        return 2
    if eff_sev == "nit":
        return 4
    return 5


def trunc(s, n):
    s = s or ""
    if len(s) > n:
        s = s[:n].rstrip() + " … [truncated — full text in findings.json]"
    # Neutralize embedded triple-backticks so free-text never opens/closes a real markdown
    # fence (a truncated ```ts block would otherwise leave the rest of the doc unclosed).
    return s.replace("```", "ʼʼʼ")


def fence(code):
    code = (code or "").rstrip()
    code = code.replace("```", "ʼʼʼ")
    return "```\n" + code + "\n```"


def build_entry(f, *, canonical_id, run, confidence):
    sev = f["severity"]
    is_live = canonical_id in LIVE_PRIMARY or canonical_id in LIVE_SESSA
    es = eff_severity(canonical_id, sev, is_live)
    phase = phase_of(es, is_live)
    cluster = f.get("cluster_id") or "—"
    cat = f["category"]
    sub = f.get("subcategory") or ""
    catline = f"{cat} · {sub}" if sub else cat
    file_line = f["file"] + (f":{f['line']}" if f.get("line") else "")
    src = (PRIMARY_SRC if run == "primary" else SESSA_SRC) + f"#{f['id']}"

    # ── notes: provenance, cross-links, recalibration rationale ──
    notes = []
    if confidence == "cross-validated":
        sa_ids = ", ".join(f"sessionA {x}" for x in folded.get(canonical_id, []))
        notes.append(f"Cross-validated: independently flagged by both 2026-06-04 runs (primary {canonical_id} ⇄ {sa_ids}).")
    elif run == "sessionA":
        notes.append(f"sessionA-only finding (99-run). Namespaced `{canonical_id}` to avoid ID collision with the primary run; original id `{f['id']}` in {SESSA_SRC}.")
    else:
        notes.append("Primary-run-only (268-run); not independently surfaced by the sessionA run.")
    if is_live:
        notes.append("**requires-live-verification** — truth/severity depends on runtime/deploy/CI state; not provable from the repo alone. Capped at `important`; needs a live check before fix/rating.")
    if canonical_id == "SEC-001":
        notes.append("Downgraded blocking→important after read-only live verification (audits/2026-06-04-adversarial-review/SEC-001-prod-verification.md). Reframed residue: (1) HSTS missing; (2) TLS terminator is out-of-repo host nginx (IaC drift, unreviewable); (3) weak ssl_protocols floor (live http-context still lists TLSv1/1.1). The committed nginx.conf genuinely has no :443 block, but it is the inner container behind the host TLS edge.")
    if canonical_id == "OBS-001":
        notes.append("Blocking→important: the static defect (AUDIT_HASH_KEY absent from .github/workflows/ci.yml) is real, but the 'API cannot boot in E2E' consequence is a CI-runtime claim. Related: SEC-002 (same root cause), SA-OBS-013 (prod env template).")
    if canonical_id == "TST-001":
        notes.append("Blocking→important: the assertion contradicting the permission matrix is statically visible, but whether it FAILS (test wrong vs endpoint over-permissive) is only realized when the e2e suite runs.")
    if canonical_id == "COR-023":
        notes.append("sessionA COR-001 rated this blocking; capped to important here — the blocking data-corruption impact is deploy-TZ-conditional and masked on the current UTC prod host.")
    if canonical_id == "COR-001":
        notes.append("Headline authz bypass. Code-verifiable; stays blocking (Phase 1). Cross-validated by sessionA COR-010.")
    rel = f.get("related_findings") or []
    if rel:
        notes.append("Related (same run): " + ", ".join(rel) + ".")
    if f.get("notes"):
        notes.append("Audit note: " + trunc(f["notes"], 600))

    # ── acceptance criteria ──
    ac = f.get("acceptance_criteria") or []
    ac_lines = "\n".join(f"{i+1}. {c}" for i, c in enumerate(ac))
    if ac_lines:
        ac_lines += f"\n{len(ac)+1}. Commit message includes `[closes {canonical_id}]`."
        ac_lines += f"\n{len(ac)+2}. Gate green (tests + types + build) per CLAUDE_SESSION_CONTRACT.md before DONE."
    else:
        ac_lines = (f"1. The fix in **Suggested fix** is implemented, addressing the failure mode in **Description**.\n"
                    f"2. A regression test fails before / passes after.\n"
                    f"3. No regression in the existing suite.\n"
                    f"4. Commit message includes `[closes {canonical_id}]`.")

    sev_badge = {"blocking": "🔴", "important": "🟠", "nit": "🟡", "suggestion": "🔵"}[es]
    cap_note = f" (capped from `{sev}`)" if es != sev else ""
    audit_conf = f.get("confidence", "?")

    out = []
    out.append(f"### {canonical_id} — {trunc(f['title'], 200)}")
    out.append("")
    out.append("- **Status:** TODO")
    out.append(f"- **Phase:** {phase}")
    out.append(f"- **Cluster:** {cluster}")
    out.append(f"- **Confidence:** {confidence}")
    out.append("- **Blocked_by:** (none)")
    out.append(f"- **Severity:** {sev_badge} {es}{cap_note}")
    out.append(f"- **Live-gated:** {'requires-live-verification' if is_live else 'no (code-verifiable)'}")
    out.append(f"- **Category:** {catline}")
    out.append(f"- **File:** `{file_line}`")
    out.append(f"- **Source:** `{src}` · audit-confidence: {audit_conf} · found_by: {f.get('found_by','?')}")
    out.append("")
    out.append("**Description:**")
    out.append(trunc(f["description"], 1400))
    out.append("")
    out.append("**Root cause:**")
    out.append(trunc(f["root_cause"], 900))
    out.append("")
    out.append("**Code evidence:**")
    out.append(fence(trunc(f["code_evidence"], 900)))
    out.append("")
    out.append("**Suggested fix:**")
    out.append(trunc(f["suggested_fix"], 1200))
    out.append("")
    out.append("**Acceptance criteria:**")
    out.append(ac_lines)
    out.append("")
    out.append("**Verification command:**")
    out.append(fence(f["verification_command"]))
    out.append("")
    out.append("**Notes:**")
    for n in notes:
        out.append(f"- {n}")
    out.append("")
    out.append("**Closed_by:** (empty — TODO)")
    out.append("")
    out.append("---")
    return out, dict(id=canonical_id, phase=phase, eff_sev=es, orig_sev=sev, cluster=cluster,
                     confidence=confidence, is_live=is_live, category=cat)


# ── assemble entries ──
entries = []  # (sort_key, text_lines, meta)
for f in PRIMARY:
    cid = f["id"]
    conf = "cross-validated" if cid in duped_primary_ids else "primary-only"
    lines, meta = build_entry(f, canonical_id=cid, run="primary", confidence=conf)
    entries.append((lines, meta))

for f in SESSA:
    if f["id"] in sessa_dup_ids:
        continue  # folded into a primary entry as a cross-link
    cid = "SA-" + f["id"]
    lines, meta = build_entry(f, canonical_id=cid, run="sessionA", confidence="secondary-only")
    entries.append((lines, meta))

# ── sort: phase asc, then cross-validated first, then severity, then cluster, then id ──
conf_rank = {"cross-validated": 0, "primary-only": 1, "secondary-only": 2}
def sort_key(item):
    m = item[1]
    return (m["phase"], conf_rank[m["confidence"]], SEV_RANK[m["eff_sev"]], str(m["cluster"]), m["id"])
entries.sort(key=sort_key)

# ── totals ──
metas = [m for _, m in entries]
n_total = len(metas)
n_dup = len(DUP)
n_live = sum(1 for m in metas if m["is_live"])
by_phase = Counter(m["phase"] for m in metas)
by_sev = Counter(m["eff_sev"] for m in metas)
by_conf = Counter(m["confidence"] for m in metas)
by_cat = Counter(m["category"] for m in metas)

PHASE_NAMES = {
    1: "Code-verifiable blockers",
    2: "Important — code-verifiable (by cluster)",
    3: "Requires-live-verification (capped at important · pending a live check)",
    4: "Nit",
    5: "Suggestion",
}

header = []
header.append("# ORCHESTRA — Adversarial Review Remediation Backlog (2026-06-04 merge)")
header.append("")
header.append("> **Source audits (merged):**")
header.append(f">   - `{PRIMARY_SRC}` — 268 findings, optimized run (**primary / canonical**; survived the adversarial refutation wave).")
header.append(f">   - `{SESSA_SRC}` — 99 findings, earlier run (**sessionA**).")
header.append(">   - `audits/2026-06-04-adversarial-review/SEC-001-prod-verification.md` — the read-only live correction (folded into SEC-001).")
header.append("> **Generated:** 2026-06-05 by `scripts/build-merged-backlog.py` (deterministic; re-runnable).")
header.append("> **Repo commit audited:** `0997b30e`.")
header.append("> **Session protocol:** `../2026-05-24-review-payloads/CLAUDE_SESSION_CONTRACT.md` (same rules: strict file scope, gate-green-to-close, append-only history, `[closes <id>]` + `Closed_by` SHA).")
header.append("> **Coherence gate:** `scripts/check-backlog-coherence.sh BACKLOG.md` (this dir).")
header.append("")
header.append("## Reconciliation method")
header.append("")
header.append(f"- **Merged total:** {n_total} tasks = 268 primary + {n_total-268} sessionA-only ({n_dup} sessionA findings deduped into a primary entry).")
header.append("- **Dedup:** matched on (file + root cause). The primary entry is canonical (refutation-wave survivor); each duplicate sessionA id is cross-linked in the primary entry's **Notes** and is NOT emitted separately. sessionA-only findings are emitted with `SA-<id>` IDs to avoid collision.")
header.append("- **Both runs reuse short IDs for *different* findings** (e.g. primary `SEC-001`=nginx TLS vs sessionA `SEC-001`=admin-reset nbf). Every cross-link names its run.")
header.append("- **Severity recalibration:** the audit's blocking labels are **not** trusted blindly. Any finding whose truth/severity depends on runtime/deploy/CI/live state (TLS edge, CI/E2E boot, prod env, deploy-time locks) is **capped at `important`** and tagged **requires-live-verification** (Phase 3) — never blocking on static evidence alone. Code-verifiable blockers stay blocking (Phase 1).")
header.append("- **SEC-001** applied: `blocking → important` per the live verification (prod terminates TLS at an out-of-repo certbot host nginx). Reframed residue: HSTS missing + TLS-terminator IaC drift + weak `ssl_protocols` floor.")
header.append("")
header.append("> ⚠️ **Scope of this merge:** dedup is *across the two 2026-06-04 runs only*. Overlap with the older `2026-05-24` remediation cycle (sibling dir) was **NOT** deduped — some items here may already be DONE/superseded there. A verify pass should reconcile before remediation.")
header.append("")
header.append("## Totals")
header.append("")
header.append(f"- **Tasks:** {n_total}  ·  **deduped (sessionA→primary):** {n_dup}  ·  **requires-live-verification:** {n_live}")
header.append("- **By effective severity:** " + " · ".join(f"{by_sev.get(s,0)} {s}" for s in ("blocking","important","nit","suggestion")))
header.append("- **By provenance:** " + " · ".join(f"{by_conf.get(c,0)} {c}" for c in ("cross-validated","primary-only","secondary-only")))
header.append("- **By category:** " + " · ".join(f"{by_cat[c]} {c}" for c in sorted(by_cat)))
header.append("")
header.append("## Prioritized phases")
header.append("")
for p in sorted(by_phase):
    header.append(f"- **Phase {p} — {PHASE_NAMES[p]}:** {by_phase[p]} tasks")
header.append("")
header.append("## Schema legend")
header.append("")
header.append("Each task: `Status` (TODO→IN_PROGRESS→DONE→VERIFIED), `Phase` (priority band 1–5), `Cluster` (root-cause group A–T from the audit), `Confidence` (provenance: cross-validated / primary-only / secondary-only), `Blocked_by`, `Severity` (effective, after recalibration), `Live-gated`, `Category`, `File`, `Source` (truth lives in findings.json), `Closed_by` (SHA, required by the coherence gate for DONE/VERIFIED).")
header.append("")
header.append("---")
header.append("")

# Phase 1 highlight: code-verifiable blockers
p1 = [m["id"] for _, m in entries if m["phase"] == 1]
header.append("### Phase-1 code-verifiable blockers (close first)")
header.append("")
for _, m in entries:
    if m["phase"] == 1:
        header.append(f"- `{m['id']}` ({m['confidence']})")
header.append("")
header.append("---")
header.append("")

# emit with per-phase section banners
body = []
cur_phase = None
for lines, m in entries:
    if m["phase"] != cur_phase:
        cur_phase = m["phase"]
        body.append(f"## Phase {cur_phase} — {PHASE_NAMES[cur_phase]}")
        body.append("")
    body.extend(lines)
    body.append("")

OUT.write_text("\n".join(header + body) + "\n")
print(f"WROTE {OUT}")
print(f"  merged total       : {n_total}")
print(f"  deduped (sessionA) : {n_dup}")
print(f"  requires-live-verif: {n_live}")
print(f"  by phase           : {dict(sorted(by_phase.items()))}")
print(f"  by eff severity    : {dict(by_sev)}")
print(f"  by provenance      : {dict(by_conf)}")
print(f"  phase-1 blockers   : {p1}")
# sanity: '### ' block count must equal n_total
txt = OUT.read_text()
nblocks = len(re.findall(r'^### [A-Z]+(?:-[A-Z]+)*-\d+ — ', txt, re.M))
print(f"  ### task blocks     : {nblocks}  (expected {n_total}: {'OK' if nblocks==n_total else 'MISMATCH'})")
