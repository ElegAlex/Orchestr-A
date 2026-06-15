export const meta = {
  name: 'adversarial-review-2026-06-08',
  description: 'Exhaustive audit-grade adversarial code review: 6 dimensions sharded, per-finding refutation, coverage reconciliation, persisted',
  phases: [
    { title: 'MAP', detail: 'sharded dimension scan + per-shard refutation' },
    { title: 'Verify', detail: 'blocking second-pass refutation' },
    { title: 'Coverage', detail: 'reconcile scanned files vs ground truth, gap-fill' },
    { title: 'Reduce', detail: 'cluster + dedup + verdict' },
    { title: 'Persist', detail: 'write audit files to disk' },
  ],
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ROOT = '/home/alex/Documents/REPO/ORCHESTRA'
const OUT = ROOT + '/audits/2026-06-08-adversarial-review'
const MODEL = 'sonnet'

const CONTROLLERS = [
  'apps/api/src/app.controller.ts','apps/api/src/metrics/metrics.controller.ts','apps/api/src/health/health.controller.ts',
  'apps/api/src/testing/testing.controller.ts','apps/api/src/clients/projects-clients.controller.ts','apps/api/src/clients/clients.controller.ts',
  'apps/api/src/planning-export/planning-export.controller.ts','apps/api/src/personal-todos/personal-todos.controller.ts',
  'apps/api/src/planning/planning.controller.ts','apps/api/src/skills/skills.controller.ts',
  'apps/api/src/third-parties/projects-third-party-members.controller.ts','apps/api/src/third-parties/tasks-third-party-assignees.controller.ts',
  'apps/api/src/third-parties/third-parties.controller.ts','apps/api/src/rbac/roles.controller.ts','apps/api/src/milestones/milestones.controller.ts',
  'apps/api/src/events/events.controller.ts','apps/api/src/documents/documents.controller.ts','apps/api/src/departments/departments.controller.ts',
  'apps/api/src/predefined-tasks/predefined-tasks.controller.ts','apps/api/src/settings/settings.controller.ts','apps/api/src/comments/comments.controller.ts',
  'apps/api/src/users/users.controller.ts','apps/api/src/services/services.controller.ts','apps/api/src/holidays/holidays.controller.ts',
  'apps/api/src/leaves/leaves.controller.ts','apps/api/src/school-vacations/school-vacations.controller.ts','apps/api/src/epics/epics.controller.ts',
  'apps/api/src/auth/auth.controller.ts','apps/api/src/analytics/advanced/analytics-advanced.controller.ts','apps/api/src/analytics/analytics.controller.ts',
  'apps/api/src/leave-types/leave-types.controller.ts','apps/api/src/projects/projects.controller.ts','apps/api/src/time-tracking/time-tracking.controller.ts',
  'apps/api/src/tasks/tasks.controller.ts','apps/api/src/telework/telework.controller.ts',
]

const SERVICES = [
  'apps/api/src/analytics/advanced/services/milestones-completion.service.ts','apps/api/src/analytics/advanced/services/project-health.service.ts',
  'apps/api/src/analytics/advanced/services/recent-activity.service.ts','apps/api/src/analytics/advanced/services/snapshots-query.service.ts',
  'apps/api/src/analytics/advanced/services/tasks-breakdown.service.ts','apps/api/src/analytics/advanced/services/workload.service.ts',
  'apps/api/src/analytics/advanced/snapshot-scheduler.service.ts','apps/api/src/analytics/analytics.service.ts','apps/api/src/app.service.ts',
  'apps/api/src/audit/audit-persistence.service.ts','apps/api/src/audit/audit.service.ts','apps/api/src/auth/auth.service.ts',
  'apps/api/src/auth/jwt-blacklist.service.ts','apps/api/src/auth/jwt-not-before.service.ts','apps/api/src/auth/login-lockout.service.ts',
  'apps/api/src/auth/refresh-token.service.ts','apps/api/src/clients/clients.service.ts','apps/api/src/comments/comments.service.ts',
  'apps/api/src/common/services/access-scope.service.ts','apps/api/src/common/services/cache.service.ts','apps/api/src/common/services/ownership.service.ts',
  'apps/api/src/common/services/role-hierarchy.service.ts','apps/api/src/departments/departments.service.ts','apps/api/src/deployments/deployments.service.ts',
  'apps/api/src/documents/documents.service.ts','apps/api/src/epics/epics.service.ts','apps/api/src/events/events.service.ts',
  'apps/api/src/health/health.service.ts','apps/api/src/holidays/holidays.service.ts','apps/api/src/leaves/leaves.service.ts',
  'apps/api/src/leave-types/leave-types.service.ts','apps/api/src/metrics/metrics.service.ts','apps/api/src/milestones/milestones.service.ts',
  'apps/api/src/personal-todos/personal-todos.service.ts','apps/api/src/planning-export/planning-export.service.ts','apps/api/src/planning/planning.service.ts',
  'apps/api/src/predefined-tasks/predefined-tasks.service.ts','apps/api/src/prisma/prisma.service.ts','apps/api/src/projects/projects.service.ts',
  'apps/api/src/rbac/permissions.service.ts','apps/api/src/rbac/roles.service.ts','apps/api/src/school-vacations/school-vacations.service.ts',
  'apps/api/src/services/services.service.ts','apps/api/src/settings/settings.service.ts','apps/api/src/skills/skills.service.ts',
  'apps/api/src/tasks/tasks.service.ts','apps/api/src/telework/telework.service.ts','apps/api/src/third-parties/third-parties.service.ts',
  'apps/api/src/time-tracking/time-tracking.service.ts','apps/api/src/users/users.service.ts',
]

const MIGRATIONS = [
  '20251116093059_init','20251215120000_add_missing_tables','20251225160000_add_task_assignees','20260104102501_add_holidays_and_task_fields',
  '20260214192223_add_chef_projet_events_ext_intervention','20260214200033_add_rbac_dynamic_permissions','20260214222914_add_external_intervention_to_events',
  '20260221170751_add_service_color_user_avatar','20260222150213_add_started_status_and_hidden_statuses','20260223094815_add_visible_statuses',
  '20260223102341_add_metier_roles','20260224231534_add_event_recurrence','20260321105758_add_leave_balances_and_rbac_granularity',
  '20260321112607_add_predefined_tasks_telework_recurring_password_reset','20260330142411_add_cancellation_requested_status',
  '20260330185549_add_week_interval_to_recurring_rules','20260402072633_add_subtasks','20260404211126_add_project_snapshots',
  '20260404215113_add_project_icon_manager_sponsor','20260405120000_remove_started_status','20260405131548_add_timeslot_to_predefined_tasks',
  '20260405215351_add_external_intervention_to_predefined_tasks','20260409112404_add_school_vacations','20260411100717_add_third_parties_and_time_entry_actor_xor',
  '20260415131201_add_force_password_change','20260415135502_add_refresh_tokens','20260419192835_rbac_v0_add_roles_table','20260420120000_rbac_v4_drop_legacy',
  '20260421152235_add_timeentry_dismissal_and_composite_index','20260423075303_add_clients_module','20260423175724_add_snapshot_analytics_fields',
  '20260424111457_add_weight_and_audit_log','20260424124537_add_recurrence_and_completion','20260427171000_add_predefined_task_telework_allowed',
  '20260506114304_project_archive','20260523124537_drop_max_days_per_year','20260523171000_self_approved_and_global_balance_unique',
  '20260524100000_dat005_backup_float_columns','20260524100100_dat005_convert_float_to_decimal','20260525190000_audit_logs_immutability_hash_chain_actor_snapshot',
  '20260525200000_dat007_project_fk_restrict_preserve_history','20260525210000_obs012_deployments_table','20260526120000_dat021_audit_payload_schema_version_gin_index',
  '20260527120000_dat003_dat004_business_invariants','20260527130000_dat012_promote_string_enums','20260527140000_dat013_time_format_check',
  '20260527150000_dat014_leave_type_autosync_trigger','20260527160000_dat016_unique_name_constraints','20260527170000_dat017_task_parent_requires_project_check',
  '20260527180000_dat018_task_dependency_cycle_prevention','20260527190000_dat023_leave_no_overlap_exclude','20260528120000_dat032_dat033_position_and_hours_bounds',
  '20260528130000_dat036_client_name_unique','20260528140000_dat038_event_parent_cycle_prevention','20260528150000_dat037_task_project_consistency',
  '20260528160000_dat035_project_member_role_length','20260603114945_dat010_leave_indexes','20260603115724_dat011_fk_indexes',
  '20260603120000_drop_dat005_backup_tables','20260603120451_per010_leave_missing_indexes','20260603121211_per011_user_missing_indexes',
  '20260603121745_per012_event_missing_indexes','20260603122315_per013_task_planning_indexes','20260603130000_cor014_snapshot_unique_projectid_date',
  '20260603140000_dat015_email_varchar254_lower_unique','20260603214608_dat025_document_fk_softdelete','20260603215133_dat022_department_fk_restrict',
  '20260604050007_dat028_password_reset_token_indexes','20260604050729_add_task_confidential_flag','20260604051255_add_cancelled_to_leave_status',
  '20260604051843_dat029_join_table_indexes','20260604103344_dat008_026_user_fk_full_erasure','20260604110510_dat026_user_deletedat_shell',
  '20260605180146_dat002_task_raci_user_fk','20260605182601_dat017_per035_036_dat018_reverse_fk_indexes','20260605182729_dat004_009_fk_restrict_protect_history',
  '20260605192741_dat008_015_check_constraints','20260605193013_dat013_audit_logs_no_truncate','20260605195752_obs019_user_last_login_at',
  '20260605201203_dat011_012_recurrence_check','20260606213229_phase4c_checks_indexes_fk',
]

// ---------------------------------------------------------------------------
// Per-dimension checklists (skill-mandated semantics, adapted to NestJS/Prisma/Next)
// ---------------------------------------------------------------------------
const CHECK = {
  security: [
    'Every controller route -> guarded by @RequirePermissions / @Public / equivalent? Flag unguarded mutating routes.',
    'Every input DTO -> class-validator @IsX present? @MaxLength on strings? sanitization?',
    'Every Prisma/SQL query -> parameterized, no string concatenation into $queryRawUnsafe/$executeRawUnsafe.',
    'Every secret usage -> not hardcoded, not logged, not in example envs.',
    'Every external URL field -> @IsUrl with protocol allowlist (no javascript:, no SSRF).',
    'Every file upload -> MIME allowlist + magic bytes + path reconstruction (not DB-trusted filename).',
    'Every authn/authz path -> rate limited? differential error neutralized (no user-enumeration)?',
    'CORS, CSRF, CSP, helmet, cookie flags (__Host-, SameSite, Secure, HttpOnly).',
    'JWT: nbf, exp, refresh rotation, invalidation on password reset / role change.',
  ],
  correctness: [
    'Every async function -> error path handled? rejection bubbled (no swallowed catch)?',
    'Every Promise.all -> ordering/atomicity matters? should be sequential or transactional?',
    'Every $transaction boundary -> ACID intent vs implementation (partial writes outside tx)?',
    'Every status transition -> race-safe (conditional WHERE / optimistic guard), not read-then-write?',
    'Every date/time computation -> TZ-anchored explicitly (no implicit local TZ)?',
    'Every business invariant -> enforced at API and/or DB?',
    'Every legacy column / dual-write pattern -> kept consistent?',
  ],
  data_integrity: [
    'Every migration -> reversible? wrapped so a partial apply cannot corrupt? destructive (DROP/ALTER losing data) with backup?',
    'Every ON DELETE / ON UPDATE cascade -> matches legal retention (audit/history must survive)?',
    'Every CHECK that COULD exist but does not (ranges, enums, non-negative, hours<=24, dates start<=end).',
    'Every Float used for money/time/balance -> should be Decimal?',
    'Every missing unique index (business keys, composite, partial WHERE col IS NULL).',
    'Every audit_log row -> immutable by DB trigger, not by convention?',
    'Backup strategy -> tested? encrypted? rotated? retention enforced (partition/WORM)?',
  ],
  performance: [
    'Every list endpoint -> paginated? default page size bounded (<=100)?',
    'Every loop containing await -> could be groupBy / batch (N+1)?',
    'Every find-then-map(async) -> N+1 candidate.',
    'Every JOIN-heavy / filtered+sorted query -> indexed on filter + sort columns?',
    'Every cache -> invalidation strategy? stampede protection?',
    'Every unbounded fan-out (Promise.all over user-controlled input) -> bounded?',
    'Every payload that could exceed 100KB -> bounded?',
    'Frontend: RSC vs client component, TanStack Query usage, dynamic() splitting, bundle/waterfall.',
  ],
  observability: [
    'Every sensitive action (auth, role change, leave approve/reject, document access/export, RBAC mutation, user delete, password reset, manual fix) -> persistent audit_log row?',
    'Every audit row -> before/after state? actor role snapshot? request id?',
    'Every error path -> structured log? stack? correlation id propagated?',
    'Every console.* -> central logger? PII scrubbed?',
    'Sentry / Prometheus / OpenTelemetry / tracing -> present or absent?',
    'Audit log retention -> declared and enforced?',
    'Deploy workflow -> actually deploys or stub/echo?',
  ],
  tests: [
    'Every controller -> has a *.controller.spec.ts? List controllers with NO spec.',
    'Every spec -> has BOTH happy-path AND negative-path assertions?',
    'Every *.skip (it/describe/test) -> flag with TODO age.',
    'Every expect(x).not.toBe(403)/(401) style -> flag (passes on 404, false assurance).',
    'Every mock of $transaction/db/prisma -> preserves semantics (not a no-op that hides bugs)?',
    'Every E2E test -> uses API setup, not UI login (repo convention)?',
    'CRITICAL: diff @RequirePermissions decorators in apps/api/src against e2e/fixtures/permission-matrix.ts entries; report BOTH counts and any decorator with no matrix row / matrix row with no decorator.',
  ],
}

// Map shards: {dim, key, scope}
const SHARDS = [
  // ---- SECURITY x8
  { dim:'security', key:'sec-auth', scope:'apps/api/src/auth/**, apps/api/src/rbac/**, apps/api/src/users/**, apps/api/src/main.ts (helmet/CORS/CSP/cookies/body-limit), apps/api/src/common/fastify/**, apps/api/src/common/guards/**, apps/api/src/common/config/**, apps/api/src/common/validators/**' },
  { dim:'security', key:'sec-absence', scope:'apps/api/src/leaves/**, apps/api/src/leave-types/**, apps/api/src/telework/**, apps/api/src/holidays/**, apps/api/src/school-vacations/**' },
  { dim:'security', key:'sec-project', scope:'apps/api/src/projects/**, apps/api/src/epics/**, apps/api/src/milestones/**, apps/api/src/tasks/**' },
  { dim:'security', key:'sec-org', scope:'apps/api/src/clients/**, apps/api/src/third-parties/**, apps/api/src/departments/**, apps/api/src/services/**' },
  { dim:'security', key:'sec-sched', scope:'apps/api/src/planning/**, apps/api/src/planning-export/**, apps/api/src/events/**, apps/api/src/time-tracking/**' },
  { dim:'security', key:'sec-content', scope:'apps/api/src/documents/** (UPLOAD: MIME allowlist + magic bytes + path reconstruction), apps/api/src/comments/**, apps/api/src/personal-todos/**, apps/api/src/predefined-tasks/**, apps/api/src/skills/**' },
  { dim:'security', key:'sec-platform', scope:'apps/api/src/analytics/**, apps/api/src/settings/**, apps/api/src/metrics/**, apps/api/src/health/**, apps/api/src/audit/**, apps/api/src/deployments/**, apps/api/src/app.controller.ts, apps/api/src/testing/**, apps/api/src/common/services/**' },
  { dim:'security', key:'sec-infra', scope:'docker-compose.yml, docker-compose.prod.yml, docker-compose.offline.yml, docker-compose.standalone.yml, nginx/nginx.conf, infra/host-nginx/**, docker/all-in-one/nginx.conf, Dockerfile* in apps/api and apps/web, *.env.example. DO NOT open .env.production or any real secret file. Focus: exposed ports, TLS, security headers/CSP at nginx, secrets in compose, container privilege/user.' },
  // ---- CORRECTNESS x5
  { dim:'correctness', key:'cor-auth', scope:'apps/api/src/auth/**, apps/api/src/rbac/**, apps/api/src/users/**' },
  { dim:'correctness', key:'cor-absence', scope:'apps/api/src/leaves/** (balance math, year window), apps/api/src/leave-types/**, apps/api/src/telework/**, apps/api/src/holidays/**, apps/api/src/school-vacations/** (TZ, overlap, status transitions)' },
  { dim:'correctness', key:'cor-project', scope:'apps/api/src/projects/** (CANCELLED soft-delete), apps/api/src/epics/**, apps/api/src/milestones/**, apps/api/src/tasks/** (subtask/parent invariants, status transitions)' },
  { dim:'correctness', key:'cor-orgsched', scope:'apps/api/src/clients/**, apps/api/src/third-parties/**, apps/api/src/departments/**, apps/api/src/services/**, apps/api/src/planning/**, apps/api/src/planning-export/**, apps/api/src/events/** (recurrence), apps/api/src/time-tracking/** (actor XOR invariant)' },
  { dim:'correctness', key:'cor-contentplat', scope:'apps/api/src/documents/**, apps/api/src/comments/**, apps/api/src/analytics/**, apps/api/src/settings/**, apps/api/src/personal-todos/**, apps/api/src/predefined-tasks/** (occurrence generator), apps/api/src/skills/**, apps/api/src/common/services/**' },
  // ---- DATA INTEGRITY x3
  { dim:'data_integrity', key:'di-schema', scope:'packages/database/prisma/schema.prisma ONLY. Examine EVERY model. List each model scanned in scanned_files as packages/database/prisma/schema.prisma' },
  { dim:'data_integrity', key:'di-migrations', scope:'packages/database/prisma/migrations/** — open the migration.sql of EVERY migration directory. In scanned_files list each directory path you opened (packages/database/prisma/migrations/<name>).' },
  { dim:'data_integrity', key:'di-audit', scope:'apps/api/src/audit/** (immutability trigger + hash chain), apps/api/src/schema-constraints/**, apps/api/src/scripts/** and scripts/ (backup: tested/encrypted/rotated/retention), packages/database/prisma/schema.prisma (audit-related models only)' },
  // ---- PERFORMANCE x2
  { dim:'performance', key:'perf-api', scope:'apps/api/src/**/*.service.ts and apps/api/src/**/*.controller.ts — pagination/bounds, N+1, await-in-loop, unbounded Promise.all, cache, index usage' },
  { dim:'performance', key:'perf-web', scope:'apps/web/app/** (page.tsx RSC vs use-client, dynamic()), apps/web/src/services/**, apps/web/src/stores/**, apps/web/src/hooks/** — TanStack Query, payload size, request waterfalls' },
  // ---- OBSERVABILITY x2
  { dim:'observability', key:'obs-audit', scope:'apps/api/src/**/*.service.ts cross-referenced with apps/api/src/audit/** — flag sensitive mutations (role change, leave approve/reject, user delete, password reset, document export, RBAC mutation, manual fix) with NO audit_log emit; check before/after + actor snapshot + request id' },
  { dim:'observability', key:'obs-logging', scope:'apps/api/src/** logging (console.* vs logger, PII scrub, correlation id, structured errors), metrics/Sentry/OTel presence, apps/api/src/main.ts, .github/workflows/** (does deploy actually deploy or echo?), docker-publish.yml' },
  // ---- TESTS x2
  { dim:'tests', key:'test-api', scope:'apps/api/src/**/*.spec.ts (157 files). Controller<->spec coverage, happy+negative, .skip, .not.toBe(403), $transaction/prisma mock semantics. Run the @RequirePermissions (apps/api/src) vs e2e/fixtures/permission-matrix.ts diff with both counts.' },
  { dim:'tests', key:'test-e2e-web', scope:'e2e/**/*.spec.ts (48, API-setup convention + negative 403/redirect tests + skips) and apps/web/**/*.test.ts(x) (67, happy+negative, skips)' },
]

// ---------------------------------------------------------------------------
// JSON Schemas
// ---------------------------------------------------------------------------
const SEVERITY = ['blocking','important','nit','suggestion']
const CATEGORY = ['security','correctness','data_integrity','performance','observability','tests']
const CONF = ['high','medium','low']

const FINDING_ITEM = {
  type:'object',
  required:['severity','category','subcategory','title','file','line','code_evidence','description','root_cause','impact','suggested_fix','acceptance_criteria','verification_command','confidence'],
  properties:{
    severity:{enum:SEVERITY},
    category:{enum:CATEGORY},
    subcategory:{type:'string'},
    title:{type:'string'},
    file:{type:'string'},
    line:{type:['string','number']},
    code_evidence:{type:'string'},
    description:{type:'string'},
    root_cause:{type:'string'},
    impact:{type:'string'},
    suggested_fix:{type:'string'},
    acceptance_criteria:{type:'array',items:{type:'string'}},
    verification_command:{type:'string'},
    confidence:{enum:CONF},
    notes:{type:'string'},
  },
}
const MAP_SCHEMA = {
  type:'object',
  required:['findings','verified_clean','scanned_files'],
  properties:{
    findings:{type:'array',items:FINDING_ITEM},
    verified_clean:{type:'array',items:{type:'string'}},
    scanned_files:{type:'array',items:{type:'string'}},
  },
}
const VERDICT_SCHEMA = {
  type:'object',
  required:['verdicts'],
  properties:{ verdicts:{type:'array',items:{
    type:'object',
    required:['index','verdict','evidence_matches','reason','corrected_confidence'],
    properties:{
      index:{type:'number'},
      verdict:{enum:['confirmed','refuted','downgraded']},
      evidence_matches:{type:'boolean'},
      reason:{type:'string'},
      corrected_severity:{type:['string','null']},
      corrected_confidence:{enum:CONF},
    },
  }}},
}
const SYNTH_SCHEMA = {
  type:'object',
  required:['clusters','verdict','verdict_rationale','top_10_blocking','dedup_drop'],
  properties:{
    clusters:{type:'array',items:{
      type:'object',
      required:['id','title','root_cause','findings','transversal_remediation','phase_recommendation'],
      properties:{ id:{type:'string'},title:{type:'string'},root_cause:{type:'string'},findings:{type:'array',items:{type:'string'}},transversal_remediation:{type:'string'},phase_recommendation:{type:'number'} },
    }},
    verdict:{enum:['ready','needs-attention','blocking-issues']},
    verdict_rationale:{type:'string'},
    top_10_blocking:{type:'array',items:{type:'string'}},
    dedup_drop:{type:'array',items:{type:'string'}},
  },
}
const PERSIST_SCHEMA = {
  type:'object',
  required:['file','bytes','ok','note'],
  properties:{ file:{type:'string'},bytes:{type:'number'},ok:{type:'boolean'},note:{type:'string'} },
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------
function mapPrompt(dim, scope, checklist){
  return `You are a READ-ONLY adversarial code auditor on repo root ${ROOT}.
Stack: NestJS 11 + Fastify 5 + Prisma 6 + PostgreSQL (apps/api), Next.js 16 App Router + React 19 (apps/web), Vitest/Jest/Playwright. RBAC: @RequirePermissions decorators + permission templates.

DIMENSION: ${dim}
SCOPE (scan ONLY these files; be EXHAUSTIVE within scope; do not stray to other files except to confirm a cross-reference):
${scope}

CHECKLIST (apply every item to every in-scope file):
${checklist.map((c,i)=>`  ${i+1}. ${c}`).join('\n')}

RULES:
- READ-ONLY. Use Read/Grep/Glob only. NEVER edit, write, or run mutating commands.
- For EVERY issue, emit ONE finding object. code_evidence MUST be a VERBATIM copy (exact bytes, 3-10 lines) from the cited file — re-open file:line and confirm before emitting. If you cannot verify the exact snippet, DROP the finding rather than approximate.
- line = a number or a "start-end" string of the cited code.
- verification_command = an exact runnable shell command that proves the fix, or "N/A — manual verification".
- severity: blocking (exploitable/data-loss/breaks prod), important (real bug/risk), nit (minor), suggestion (improvement).
- Do NOT invent issues to fill space. A clean file produces NO finding for it — instead add it to verified_clean.
- verified_clean: list concrete things you checked AND found OK (assurance).
- scanned_files: EVERY repo-relative file path you actually opened (used for coverage reconciliation — be complete and accurate).

Return the structured object (findings, verified_clean, scanned_files).`
}

function verifyPrompt(dim, scope, batch){
  const list = batch.map((f,i)=>`[index ${i}] severity=${f.severity} | ${f.file}:${f.line}
title: ${f.title}
claimed code_evidence:
${f.code_evidence}
claim: ${f.description}`).join('\n\n---\n\n')
  return `You are an adversarial REFUTER (read-only) on repo root ${ROOT}. Dimension: ${dim}.
For EACH candidate finding below, your job is to DISPROVE it. Re-open the cited file:line yourself with Read/Grep.
For each, decide:
- confirmed: the code_evidence is verbatim-accurate AND the issue is real (no guard/mitigation elsewhere, not already fixed, not a false positive).
- refuted: evidence does not match the file, OR a mitigation/guard exists elsewhere, OR it is a false positive, OR already handled. Give the precise reason.
- downgraded: real but less severe/lower confidence than claimed; set corrected_severity and corrected_confidence.
Default toward refuted when uncertain or when you cannot independently reproduce the evidence. Set evidence_matches=false if the verbatim snippet is not actually present at that location.
Reference each finding by its 0-based index exactly as given.

CANDIDATES:
${list}

Return verdicts: one object per candidate with {index, verdict, evidence_matches, reason, corrected_severity (or null), corrected_confidence}.`
}

function blockingRefutePrompt(batch){
  const list = batch.map((f,i)=>`[index ${i}] ${f.category} | ${f.file}:${f.line}
title: ${f.title}
code_evidence:
${f.code_evidence}
impact claimed: ${f.impact}`).join('\n\n---\n\n')
  return `You are a SECOND, INDEPENDENT adversarial refuter (read-only) on ${ROOT}. These findings are claimed BLOCKING. Assume each is a FALSE POSITIVE and try hard to prove it wrong: re-read the file:line, look for guards/validators/RBAC/transactions/constraints elsewhere that neutralize it, check if it is unreachable or already mitigated. Only 'confirmed' if you genuinely cannot disprove it AND it truly merits blocking. Use 0-based index as given.

${list}

Return verdicts: {index, verdict (confirmed|refuted|downgraded), evidence_matches, reason, corrected_severity, corrected_confidence}.`
}

function synthPrompt(items){
  return `You are the REDUCE/synthesis step of an adversarial audit. Below are ${items.length} CONFIRMED findings (already verified). Do three things:
1) Cluster findings that share a ROOT CAUSE into clusters (id = single uppercase letter A,B,C...). A cluster groups cross-dimension findings with one underlying fix. Not every finding must be in a cluster; only group genuine shared root causes.
2) Identify exact DUPLICATES (same root cause + same file/line found by two dimensions) and list the temp ids to DROP in dedup_drop (keep one, drop the redundant). Do NOT drop distinct issues.
3) Decide an overall verdict (ready | needs-attention | blocking-issues) with a 2-3 line rationale, and pick top_10_blocking (temp ids of the 10 most severe; fewer if <10 blocking exist).
Reference findings by their temp id (T-001 etc).

FINDINGS:
${JSON.stringify(items,null,1)}

Return {clusters, verdict, verdict_rationale, top_10_blocking, dedup_drop}.`
}

function persistPrompt(absPath, content, jsonArrayCount){
  let p = `Persist one audit file to disk. Use the Write tool with EXACTLY this path:
${absPath}

Write EXACTLY the content between the markers — byte-for-byte. Do NOT reformat, summarize, truncate, pretty-print differently, or add ANY commentary. The file must contain only the content.

<<<CONTENT-START>>>
${content}
<<<CONTENT-END>>>

After writing, use Read to read the file back and verify it is complete and identical.`
  if(jsonArrayCount!=null) p += ` Then confirm it parses as a JSON array of EXACTLY ${jsonArrayCount} objects.`
  p += ` If readback is truncated/altered/wrong-count, RE-WRITE and re-verify (up to 3 attempts). Return {file, bytes (actual byte length on disk), ok (true ONLY if verified exact${jsonArrayCount!=null?' and count matches':''}), note}. Touch ONLY this one file.`
  return p
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function norm(s){ return String(s).replace(/^\.?\/+/,'').trim() }
function covered(unionArr, p){ const np=norm(p); return unionArr.some(s=>{ const n=norm(s); return n===np || n.endsWith('/'+np) || np.endsWith(n) }) }
function coveredMig(unionArr, name){ return unionArr.some(s=>String(s).includes('/migrations/'+name)) }
function chunk(arr,n){ const o=[]; for(let i=0;i<arr.length;i+=n) o.push(arr.slice(i,i+n)); return o }

async function refuteBatches(dim, scope, findings, phaseName, isBlocking){
  const tagged = findings.map((f,i)=>({...f,_bi:i}))
  const batches = chunk(tagged,5)
  const results = await parallel(batches.map((b,bi)=> ()=>
    agent(isBlocking?blockingRefutePrompt(b):verifyPrompt(dim,scope,b),
      {label:`${isBlocking?'refute2':'verify'}:${dim}#${bi}`, phase:phaseName, schema:VERDICT_SCHEMA, model:MODEL})
  ))
  const verdictByGlobal = {}
  results.forEach((va,bi)=>{ if(va&&Array.isArray(va.verdicts)) va.verdicts.forEach(v=>{ const f=batches[bi][v.index]; if(f) verdictByGlobal[f._bi]=v }) })
  return verdictByGlobal
}

async function verifyShard(mapRes, shard){
  const vc = (mapRes&&mapRes.verified_clean)||[]
  const sc = (mapRes&&mapRes.scanned_files)||[]
  if(!mapRes || !Array.isArray(mapRes.findings) || mapRes.findings.length===0) return {shard, findings:[], verified_clean:vc, scanned:sc}
  const verdicts = await refuteBatches(shard.dim, shard.scope||'', mapRes.findings, 'MAP', false)
  const kept = []
  mapRes.findings.forEach((f,i)=>{
    const v = verdicts[i]
    if(!v){ kept.push({...f, found_by:shard.dim, confidence:'low', notes:((f.notes||'')+' [refuter unavailable — unverified]').trim()}); return }
    if(v.verdict==='refuted') return
    const nf = {...f, found_by:shard.dim}
    if(v.verdict==='downgraded'){ nf.confidence=v.corrected_confidence||f.confidence; if(v.corrected_severity) nf.severity=v.corrected_severity }
    kept.push(nf)
  })
  return {shard, findings:kept, verified_clean:vc, scanned:sc}
}

// ---------------------------------------------------------------------------
// PHASE 1+2: MAP -> per-shard refutation (pipelined)
// ---------------------------------------------------------------------------
phase('MAP')
log(`Dispatching ${SHARDS.length} dimension x shard map units (read-only, ${MODEL})`)
const shardResults = (await pipeline(SHARDS,
  (shard)=> agent(mapPrompt(shard.dim, shard.scope, CHECK[shard.dim]), {label:`map:${shard.key}`, phase:'MAP', schema:MAP_SCHEMA, model:MODEL}),
  (mapRes, shard)=> verifyShard(mapRes, shard),
)).filter(Boolean)

// Accumulate per dimension
const byDim = {}
for(const d of CATEGORY) byDim[d] = {scanned:[], findings:[], clean:[]}
shardResults.forEach(r=>{ const d=r.shard.dim; byDim[d].scanned.push(...r.scanned); byDim[d].findings.push(...r.findings); byDim[d].clean.push(...r.verified_clean) })

// ---------------------------------------------------------------------------
// PHASE 3: COVERAGE reconciliation + gap-fill
// ---------------------------------------------------------------------------
phase('Coverage')
const gaps = {}
gaps.security = CONTROLLERS.filter(c=>!covered(byDim.security.scanned,c))
gaps.correctness = SERVICES.filter(s=>!covered(byDim.correctness.scanned,s))
gaps.data_integrity = MIGRATIONS.filter(m=>!coveredMig(byDim.data_integrity.scanned,m)).map(m=>'packages/database/prisma/migrations/'+m)
log(`Coverage gaps -> security:${gaps.security.length}/${CONTROLLERS.length} controllers, correctness:${gaps.correctness.length}/${SERVICES.length} services, data_integrity:${gaps.data_integrity.length}/${MIGRATIONS.length} migrations`)

async function gapFill(dim, missing){
  if(!missing.length) return
  const cap = missing.slice(0,40)
  const scope = 'ONLY these specific files that were not scanned in the first pass: '+cap.join(', ')
  const mr = await agent(mapPrompt(dim, scope, CHECK[dim]), {label:`gapfill:${dim}`, phase:'Coverage', schema:MAP_SCHEMA, model:MODEL})
  const vr = await verifyShard(mr, {dim, key:'gap-'+dim, scope})
  byDim[dim].scanned.push(...vr.scanned); byDim[dim].findings.push(...vr.findings); byDim[dim].clean.push(...vr.verified_clean)
  log(`gap-fill ${dim}: scanned ${vr.scanned.length}, +${vr.findings.length} findings`)
}
await parallel([
  ()=>gapFill('security', gaps.security),
  ()=>gapFill('correctness', gaps.correctness),
  ()=>gapFill('data_integrity', gaps.data_integrity),
])
// recompute residual coverage
const residual = {
  controllers_scanned: CONTROLLERS.filter(c=>covered(byDim.security.scanned,c)).length,
  services_scanned: SERVICES.filter(s=>covered(byDim.correctness.scanned,s)).length,
  migrations_scanned: MIGRATIONS.filter(m=>coveredMig(byDim.data_integrity.scanned,m)).length,
}

// ---------------------------------------------------------------------------
// PHASE 2 (blocking second pass)
// ---------------------------------------------------------------------------
phase('Verify')
let allFindings = []
for(const d of CATEGORY) allFindings.push(...byDim[d].findings)
const blocking = allFindings.filter(f=>f.severity==='blocking')
log(`Second-pass independent refutation on ${blocking.length} blocking findings`)
if(blocking.length){
  const v2 = await refuteBatches('blocking','', blocking, 'Verify', true)
  const dropRefs = new Set()
  blocking.forEach((f,i)=>{ const v=v2[i]; if(v && v.verdict==='refuted') dropRefs.add(f) })
  allFindings = allFindings.filter(f=>!dropRefs.has(f))
  log(`Second pass dropped ${dropRefs.size} blocking findings as refuted`)
}

// ---------------------------------------------------------------------------
// PHASE 4: REDUCE (synthesis + id assignment + build content)
// ---------------------------------------------------------------------------
phase('Reduce')
allFindings.forEach((f,i)=>{ f._tid = 'T-'+String(i+1).padStart(3,'0') })
const synthInput = allFindings.map(f=>({id:f._tid,title:f.title,file:f.file,line:f.line,severity:f.severity,category:f.category,found_by:f.found_by,root_cause:f.root_cause,description:String(f.description||'').slice(0,240)}))
let synth = {clusters:[],verdict:'needs-attention',verdict_rationale:'',top_10_blocking:[],dedup_drop:[]}
if(allFindings.length){
  const s = await agent(synthPrompt(synthInput), {label:'synthesize', phase:'Reduce', schema:SYNTH_SCHEMA, model:MODEL})
  if(s) synth = s
}
const dropSet = new Set(synth.dedup_drop||[])
const kept = allFindings.filter(f=>!dropSet.has(f._tid))

// final ids
const CODE = {security:'SEC',correctness:'COR',data_integrity:'DAT',performance:'PER',observability:'OBS',tests:'TST'}
const SEVRANK = {blocking:0,important:1,nit:2,suggestion:3}
kept.sort((a,b)=> (CATEGORY.indexOf(a.category)-CATEGORY.indexOf(b.category)) || (SEVRANK[a.severity]-SEVRANK[b.severity]))
const counters = {}
kept.forEach(f=>{ const c=CODE[f.category]||'GEN'; counters[c]=(counters[c]||0)+1; f.id=c+'-'+String(counters[c]).padStart(3,'0') })
const tid2id = {}; kept.forEach(f=>{ tid2id[f._tid]=f.id })

// clusters -> final ids, assign cluster_id + related_findings
const clusters = []
;(synth.clusters||[]).forEach(cl=>{
  const ids = (cl.findings||[]).map(t=>tid2id[t]).filter(Boolean)
  if(!ids.length) return
  clusters.push({ id:cl.id, title:cl.title, root_cause:cl.root_cause, findings:ids, transversal_remediation:cl.transversal_remediation, phase_recommendation:cl.phase_recommendation })
  ids.forEach(fid=>{ const f=kept.find(x=>x.id===fid); if(f){ f.cluster_id=cl.id; f.related_findings=ids.filter(o=>o!==fid) } })
})

// finalize finding objects (strip internals, ensure all schema fields)
const findings = kept.map(f=>({
  id:f.id, severity:f.severity, category:f.category, subcategory:f.subcategory||'', title:f.title,
  file:f.file, line:f.line, code_evidence:f.code_evidence, description:f.description, root_cause:f.root_cause,
  impact:f.impact, suggested_fix:f.suggested_fix, acceptance_criteria:f.acceptance_criteria||[],
  verification_command:f.verification_command||'N/A — manual verification',
  related_findings:f.related_findings||[], cluster_id:f.cluster_id||null, found_by:f.found_by||f.category,
  confidence:f.confidence||'medium', notes:f.notes||'',
}))

// totals
const by_category = {}; CATEGORY.forEach(c=>by_category[c]=findings.filter(f=>f.category===c).length)
const totals = {
  findings: findings.length,
  blocking: findings.filter(f=>f.severity==='blocking').length,
  important: findings.filter(f=>f.severity==='important').length,
  nit: findings.filter(f=>f.severity==='nit').length,
  suggestion: findings.filter(f=>f.severity==='suggestion').length,
  by_category,
}
const top10 = (synth.top_10_blocking||[]).map(t=>tid2id[t]).filter(Boolean)
if(top10.length===0){ findings.filter(f=>f.severity==='blocking').slice(0,10).forEach(f=>top10.push(f.id)) }

const summary = {
  report_date:'2026-06-08',
  repo_commit: args && args.commit ? args.commit : 'b9347d2f809ca2c1d897cbf3bc59bebfbfeb68ac',
  verdict: synth.verdict || (totals.blocking>0?'blocking-issues':(totals.important>0?'needs-attention':'ready')),
  verdict_rationale: synth.verdict_rationale || '',
  totals,
  top_10_blocking: top10,
  key_metrics:{
    controllers_total:CONTROLLERS.length, services_total:SERVICES.length, migrations_total:MIGRATIONS.length,
    schema_models:44, require_permissions_decorators:251, public_routes:19, raw_query_calls:225,
    transactions:239, web_pages:30, web_components:91, api_specs:157, web_tests:67, e2e_specs:48,
  },
  coverage_assertion:{
    controllers_scanned:residual.controllers_scanned,
    migrations_scanned:residual.migrations_scanned,
    services_scanned:residual.services_scanned,
    test_files_scanned:(byDim.tests.scanned.filter(s=>/\.(spec|test)\.tsx?$/.test(s))).length,
    untracked_files_included:0,
  },
}

// per-dimension raw payloads (one file per dimension)
function dedupStr(a){ return Array.from(new Set(a)) }
const perDim = {}
CATEGORY.forEach(d=>{
  perDim[d] = {
    dimension:d,
    findings: findings.filter(f=>f.found_by===d),
    verified_clean: dedupStr(byDim[d].clean),
    scanned_files: dedupStr(byDim[d].scanned),
  }
})

// ---------------------------------------------------------------------------
// PHASE 5: PERSIST (agents write files; findings.json chunked to scratch for safe merge)
// ---------------------------------------------------------------------------
phase('Persist')
const writes = []
// summary.json
writes.push(()=>agent(persistPrompt(OUT+'/summary.json', JSON.stringify(summary,null,2), null), {label:'persist:summary', phase:'Persist', schema:PERSIST_SCHEMA, model:MODEL}))
// clusters.json
writes.push(()=>agent(persistPrompt(OUT+'/clusters.json', JSON.stringify(clusters,null,2), null), {label:'persist:clusters', phase:'Persist', schema:PERSIST_SCHEMA, model:MODEL}))
// per-dimension agent files
CATEGORY.forEach(d=>{
  writes.push(()=>agent(persistPrompt(OUT+'/agents/'+d+'.json', JSON.stringify(perDim[d],null,2), null), {label:'persist:'+d, phase:'Persist', schema:PERSIST_SCHEMA, model:MODEL}))
})
// findings chunked
const fchunks = chunk(findings,15)
fchunks.forEach((c,i)=>{
  writes.push(()=>agent(persistPrompt(OUT+'/scratch/findings-part-'+String(i).padStart(2,'0')+'.json', JSON.stringify(c,null,2), c.length), {label:'persist:findings#'+i, phase:'Persist', schema:PERSIST_SCHEMA, model:MODEL}))
})
const persistReports = (await parallel(writes)).filter(Boolean)

return {
  verdict: summary.verdict,
  totals,
  coverage: summary.coverage_assertion,
  gaps_after_fill:{ controllers:CONTROLLERS.length-residual.controllers_scanned, services:SERVICES.length-residual.services_scanned, migrations:MIGRATIONS.length-residual.migrations_scanned },
  findings_total: findings.length,
  findings_chunks: fchunks.length,
  per_dim_counts: by_category,
  persist_ok: persistReports.filter(r=>r&&r.ok).length,
  persist_total: persistReports.length,
  persist_reports: persistReports,
  paths:{ out:OUT, scratch:OUT+'/scratch', agents:OUT+'/agents' },
}
