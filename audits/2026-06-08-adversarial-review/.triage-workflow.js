export const meta = {
  name: 'audit-2026-06-08-triage',
  description: 'Disposition the 131 non-fix-set findings of the 2026-06-08 audit against current code + AB-001',
  phases: [
    { title: 'Triage', detail: 'one agent per shard, disposition each finding vs HEAD code', model: 'sonnet' },
    { title: 'Refute', detail: 'attack the ACCEPTED / ALREADY_FIXED verdicts (false-accept is the costly error)', model: 'sonnet' },
  ],
}

// ---- Shared context every agent gets -------------------------------------
const AB001 = `
AB-001 (operator decision 2026-06-06) — ACCEPTED intended design, NOT a vuln:
Org-wide READ of (a) tasks via tasks:readAll, (b) leaves/conges via leaves:readAll,
(c) telework via telework:readAll, and (d) the user DIRECTORY (GET /users*) gated by
users:read, is INTENTIONAL. Orchestr'A is a planning tool; every authenticated user
is meant to see everyone's tasks/leave/telework and the staff directory.
Covered read paths: GET /tasks/assignee/:userId, GET /leaves?userId, GET /telework?userId,
the service findAll paths gated on the three *:readAll perms, and the directory reads
(GET /users, /users/:id, /users/department/:id, /users/service/:id, /users/role/:role,
/users/presence) gated by users:read.
ACCEPTANCE IS READ-ONLY and ONLY for those 4 domains. NOT accepted: any WRITE/approve/
modify/role/scope mutation; any user-directory WRITE; and any READ whose gating permission
is NOT one of {tasks:readAll, leaves:readAll, telework:readAll, users:read} OR whose
exposed fields fall OUTSIDE those 4 domains (e.g. project budgets, a non-directory email
leak via skills:read, cross-project milestone/epic project rows).`

const UNIFORM_TEST = `
UNIFORM AB-001 TEST — apply to every READ-exposure finding, all 3 must hold to ACCEPT:
(a) DOMAIN: the exposed data is one of the 4 named domains (tasks / leaves / telework / user-directory).
(b) GATE: the endpoint is gated by that domain's exact permission (tasks:readAll / leaves:readAll /
    telework:readAll / users:read) — NOT a weaker/different permission.
(c) FIELDS: every field returned is within that domain (no project financials, no email via a
    non-directory gate, no cross-project hierarchy rows).
If any of (a)(b)(c) fails -> the finding is NOT covered by AB-001. WRITE/mutate findings are NEVER
covered by AB-001.`

const RULES = `
You are triaging ONE shard of a 147-finding adversarial audit (report_date 2026-06-08,
baseline commit b9347d2f ~= current HEAD) against the CURRENT code on disk.
Repo root is the cwd. Findings live in audits/2026-06-08-adversarial-review/findings.json.

For EACH finding id you own:
1. Read the finding: jq --arg id "<ID>" '.[]|select(.id==$id)' audits/2026-06-08-adversarial-review/findings.json
2. OPEN the cited file at file:line and READ the real current code. Do NOT trust the finding's
   static snapshot — verify on disk. Use Read/Grep/Bash(read-only). DO NOT EDIT ANY FILE.
3. Decide a disposition from this vocabulary:
   - ACCEPTED      : intended design / passes the AB-001 uniform test. (READ exposures only.)
   - ALREADY_FIXED : current HEAD code already addresses it (quote the current code that fixes it).
   - WONT_FIX      : real but low-value/not-worth-it; give a crisp cost/benefit rationale.
   - REAL_DEFERRED : genuine issue, but part of a transversal cluster / out of this session's
                     hand-fix scope (e.g. DTO-validation sweep, UTC-date sweep, frontend perf,
                     CHECK-constraint migration, audit-coverage expansion). Track as backlog.
   - REAL_FIX_NOW  : genuine, narrow, high-value, and NOT already covered by the fix-set below —
                     flag it so the orchestrator can hand-fix. Use sparingly.
4. severity_assessment: agree | downgrade:<sev> | upgrade:<sev> vs the finding's own severity,
   with one clause why. (sev in blocking|important|nit|suggestion)
5. evidence: file:line + the SPECIFIC current-code fact that grounds your verdict (<=200 chars).
6. rationale: one line.

FIX-SET already being hand-fixed by the orchestrator (do NOT mark these REAL_FIX_NOW; if one of
your ids overlaps, note it but the orchestrator owns it): COR-028, COR-001, DAT-001, SEC-001,
SEC-003, SEC-004, SEC-005, SEC-006, SEC-007, SEC-008, SEC-009, SEC-010, SEC-012, SEC-013,
SEC-017, SEC-020.

Be precise and skeptical. A finding that re-asserts AB-001 MUST resolve to ACCEPTED, not important.
Your output is data, not prose — return the structured object only.

${AB001}
${UNIFORM_TEST}`

const TRIAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['dispositions'],
  properties: {
    dispositions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'disposition', 'severity_assessment', 'evidence', 'rationale'],
        properties: {
          id: { type: 'string' },
          disposition: { enum: ['ACCEPTED', 'ALREADY_FIXED', 'WONT_FIX', 'REAL_DEFERRED', 'REAL_FIX_NOW'] },
          severity_assessment: { type: 'string' },
          evidence: { type: 'string' },
          rationale: { type: 'string' },
        },
      },
    },
  },
}

const REFUTE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reviews'],
  properties: {
    reviews: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'upheld', 'corrected_disposition', 'why'],
        properties: {
          id: { type: 'string' },
          upheld: { type: 'boolean' },
          corrected_disposition: { enum: ['ACCEPTED', 'ALREADY_FIXED', 'WONT_FIX', 'REAL_DEFERRED', 'REAL_FIX_NOW'] },
          why: { type: 'string' },
        },
      },
    },
  },
}

const SHARDS = [
  { name: 'B-dto-validation', ids: ['SEC-002','SEC-014','SEC-015','SEC-016','SEC-021','COR-003','COR-011','COR-012','COR-014','COR-015','COR-016','COR-017','COR-018','DAT-007','DAT-008','DAT-009','DAT-010','DAT-011','DAT-012'] },
  { name: 'C-utc-dates', ids: ['COR-004','COR-005','COR-010','COR-020','COR-022','COR-023','COR-026','COR-027','COR-035'] },
  { name: 'D-atomicity', ids: ['DAT-002','DAT-003','DAT-004','DAT-006','COR-029','COR-030','COR-031'] },
  { name: 'EF-span-deps', ids: ['PER-001','PER-002','PER-003'] },
  { name: 'GH-frontend-perf', ids: ['PER-006','PER-007','PER-008','PER-009','PER-010','PER-011','PER-012','PER-013','PER-019','PER-020','PER-021','PER-022','PER-023','PER-024','PER-025'] },
  { name: 'I-analytics', ids: ['PER-005','PER-016','PER-017','PER-018'] },
  { name: 'JK-audit-coverage', ids: ['OBS-002','OBS-003','OBS-004','OBS-005','OBS-007','OBS-010','OBS-011','OBS-012'] },
  { name: 'L-check-constraints', ids: ['DAT-014','DAT-015','DAT-022','DAT-026','DAT-027'] },
  { name: 'M-docker', ids: ['SEC-024','SEC-025','SEC-026','SEC-027','SEC-028','SEC-029','SEC-030','SEC-031','SEC-032','SEC-033'] },
  { name: 'N-tests', ids: ['TST-001','TST-002','TST-003','TST-004','TST-005','TST-006','TST-007','TST-008','TST-009'] },
  { name: 'COR-misc', ids: ['COR-002','COR-006','COR-007','COR-008','COR-009','COR-013','COR-019','COR-021','COR-024','COR-025','COR-032','COR-033','COR-034','COR-036','COR-037','COR-038','COR-039'] },
  { name: 'SEC-OBS-misc', ids: ['SEC-011','SEC-018','SEC-019','SEC-022','SEC-023','OBS-001','OBS-006','OBS-008','OBS-009','OBS-013','OBS-014'] },
  { name: 'DAT-PER-misc', ids: ['DAT-005','DAT-013','DAT-016','DAT-017','DAT-018','DAT-019','DAT-020','DAT-021','DAT-023','DAT-024','DAT-025','PER-004','PER-014','PER-015'] },
]

phase('Triage')
log(`Triaging ${SHARDS.reduce((n,s)=>n+s.ids.length,0)} findings across ${SHARDS.length} shards`)

const results = await pipeline(
  SHARDS,
  (shard) => agent(
    `${RULES}\n\nYOUR SHARD: ${shard.name}\nYour finding ids (${shard.ids.length}): ${shard.ids.join(', ')}\nReturn one disposition object per id.`,
    { label: `triage:${shard.name}`, phase: 'Triage', schema: TRIAGE_SCHEMA },
  ),
  // Refute the ACCEPTED + ALREADY_FIXED verdicts of THIS shard (false-accept is the costly error).
  (triage, shard) => {
    if (!triage || !triage.dispositions) return { shard: shard.name, dispositions: [], reviews: [] }
    const toRefute = triage.dispositions.filter(d => d.disposition === 'ACCEPTED' || d.disposition === 'ALREADY_FIXED')
    if (toRefute.length === 0) return { shard: shard.name, dispositions: triage.dispositions, reviews: [] }
    const list = toRefute.map(d => `${d.id} [${d.disposition}] claim: ${d.rationale} | evidence: ${d.evidence}`).join('\n')
    return agent(
      `You are an ADVERSARIAL refuter. The triage pass marked the findings below ACCEPTED or
ALREADY_FIXED. In an AB-001-broad triage, a FALSE-ACCEPT (waving through a real vuln) is the
costliest error — attack each claim. Repo root is cwd; OPEN the cited code on disk and verify.
DO NOT EDIT FILES.

For ACCEPTED: re-run the UNIFORM AB-001 TEST — is the gating permission EXACTLY one of
{tasks:readAll,leaves:readAll,telework:readAll,users:read}? Is the data one of the 4 named
domains? Are ALL returned fields within that domain? Is it truly READ-only (no mutate)? If any
fails -> NOT covered -> set upheld=false and corrected_disposition to REAL_DEFERRED or REAL_FIX_NOW.
For ALREADY_FIXED: does HEAD code REALLY fix it? Quote the line. If not -> upheld=false.

If the accept holds under scrutiny, upheld=true and echo the disposition.

${AB001}
${UNIFORM_TEST}

Findings to refute:
${list}

Read each finding via jq from audits/2026-06-08-adversarial-review/findings.json and read the cited code.`,
      { label: `refute:${shard.name}`, phase: 'Refute', schema: REFUTE_SCHEMA },
    ).then(r => ({ shard: shard.name, dispositions: triage.dispositions, reviews: (r && r.reviews) || [] }))
  },
)

// Merge refuter corrections into the triage dispositions.
const merged = []
for (const res of results.filter(Boolean)) {
  const reviewById = {}
  for (const rv of res.reviews) reviewById[rv.id] = rv
  for (const d of res.dispositions) {
    const rv = reviewById[d.id]
    if (rv && rv.upheld === false) {
      merged.push({ ...d, disposition: rv.corrected_disposition, shard: res.shard, refuted: true, refuter_note: rv.why, original_disposition: d.disposition })
    } else {
      merged.push({ ...d, shard: res.shard, refuted: false })
    }
  }
}

const tally = {}
for (const m of merged) tally[m.disposition] = (tally[m.disposition] || 0) + 1
const overturned = merged.filter(m => m.refuted)
log(`Triaged ${merged.length} findings. Tally: ${JSON.stringify(tally)}. Refuter overturned ${overturned.length}.`)

return { count: merged.length, tally, overturned_count: overturned.length, dispositions: merged }
