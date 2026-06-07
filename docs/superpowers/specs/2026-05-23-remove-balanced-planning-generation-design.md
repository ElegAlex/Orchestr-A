# Remove balanced planning auto-generation

**Date**: 2026-05-23
**Type**: Feature removal
**Status**: Approved

## Context

The Plannings module currently exposes an "automatic balanced planning generation" feature: a button surfacing a modal where the user selects a period, a service scope, agents and tasks, then asks the system to compute and (optionally) apply a balanced distribution of recurring task occurrences across eligible agents. The algorithm respects absence, telework, and skill constraints and reports an equity ratio.

Decision: remove the feature. It does not deliver value in actual usage and adds complexity to the activity view. Manual assignment remains the only way to allocate agents to task occurrences.

## Scope

### What is removed

The complete auto-generation pipeline, end to end:

- Backend balancer algorithm and types
- Backend endpoint exposing the generation
- Backend service orchestration (RBAC scope resolution, occurrence materialization for balancing, transactional apply)
- Frontend modal, hook, service method, and the trigger button in the planning view
- RBAC permission key `predefined_tasks:balance` and its bindings in role templates
- Unit tests, component tests, and E2E tests covering the feature

### What is preserved

- The `predefined-tasks` module: recurring task definitions, recurring rules, occurrence materialization, manual assignment endpoints
- The three planning views: week, month, **and activity** (the view itself stays)
- The `ActivityGrid` component and its grid rendering
- Manual assignment of agents to task occurrences
- The `task_assignments` table and all related Prisma models (no schema change, no migration)

## File-level inventory

### Files to delete

Backend:

- `apps/api/src/predefined-tasks/planning-balancer.service.ts`
- `apps/api/src/predefined-tasks/planning-balancer.types.ts`
- `apps/api/src/predefined-tasks/planning-balancer.service.spec.ts`
- `apps/api/src/predefined-tasks/dto/generate-balanced.dto.ts`

Frontend:

- `apps/web/src/components/predefined-tasks/BalancedPlanningModal.tsx`
- `apps/web/src/components/predefined-tasks/__tests__/BalancedPlanningModal.test.tsx`
- `apps/web/src/hooks/usePlanningBalancer.ts`
- `apps/web/src/hooks/__tests__/usePlanningBalancer.test.ts`

E2E:

- `e2e/tests/workflows/balanced-planning.spec.ts`

### Files to edit

Backend:

- `apps/api/src/predefined-tasks/predefined-tasks.controller.ts` — remove the `POST /predefined-tasks/recurring-rules/generate-balanced` handler and its imports
- `apps/api/src/predefined-tasks/predefined-tasks.service.ts` — remove `generateBalanced()` method and any helper exclusively used by it
- `apps/api/src/predefined-tasks/predefined-tasks.module.ts` — remove `PlanningBalancerService` from providers
- `apps/api/src/predefined-tasks/predefined-tasks.service.spec.ts` — remove `describe`/`it` blocks targeting `generateBalanced`

Frontend:

- `apps/web/src/services/predefined-tasks.service.ts` — remove `generateBalanced()` method and the types `GenerateBalancedDto`, `BalancerProposedAssignment`, `BalancerResult`, `BalancerUnassignedReason`, `BalancerMode`
- `apps/web/src/components/planning/PlanningView.tsx` — remove the `BalancedPlanningModal` import, the `showBalancer` state, the "Planning équilibré" button block, and the modal render block

RBAC:

- Remove the `predefined_tasks:balance` permission key from `ROLE_TEMPLATES` (compile-time templates) and any UI listing of permissions
- Post-deploy: purge Redis `role-permissions:*` per project convention

Docs:

- `docs/adr/2026-04-24-03-balancer-algorithm.md` — mark `Status: Superseded — feature removed 2026-05-23` with a one-line rationale; do not delete (ADRs are historical artifacts)
- Mockup `docs/superpowers/mockups/2026-04-24-planning-activites/E4.3-balanced-planning-modal.html` — leave in place; not referenced by code

## Acceptance criteria

1. `pnpm run build` passes with zero TypeScript errors.
2. `pnpm run test` passes for both API (Vitest) and Web (Jest) workspaces.
3. The following greps return zero hits under `apps/` and `e2e/`:
   - `generate-balanced`
   - `PlanningBalancer`
   - `BalancedPlanningModal`
   - `usePlanningBalancer`
   - `predefined_tasks:balance`
   - `generateBalanced`
4. The planning page loads without error and shows the three views (week, month, activity).
5. The activity view renders the days × tasks grid with manually assigned agents.
6. The Swagger doc at `/api/docs` no longer lists the `generate-balanced` endpoint.
7. Calling `POST /predefined-tasks/recurring-rules/generate-balanced` returns 404.
8. No user role retains a `predefined_tasks:balance` permission (verified by reading role templates or via the admin UI).
9. The ADR `2026-04-24-03-balancer-algorithm.md` shows `Status: Superseded`.

## Risk and rollback

- Risk: low. The feature is self-contained — no other module imports `PlanningBalancerService`, no other endpoint composes the balancer result, no DB schema change.
- Rollback: revert the removal commit. No data migration required since the table layout is untouched.

## Out of scope

- Refactoring `predefined-tasks.service.ts` beyond removing the dead method
- Touching the activity view's rendering logic
- Modifying the assignment manual workflows
- Adjusting the RBAC system itself (only the one permission key disappears)
