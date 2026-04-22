# Migration Gaps — V2-E (Gantt avatar unification)

Gaps identified during the replacement of private Gantt avatar components with `UserAvatar`.

## Summary

`GanttTaskRow` and `GanttPortfolioRow` carry only flat string fields (`assigneeName`, `managerName`) instead of a full `UserSummary` object. V4-A enriched the API Prisma selects with `avatarUrl` + `avatarPreset`, but this enrichment has not yet propagated to the Gantt row type definitions or the upstream mappers that build these rows from task/project payloads.

**Workaround applied:** A best-effort `UserSummary` literal is constructed inline (splitting the name string on the first space to derive `firstName`/`lastName`, `id` taken from `row.id`, `avatarUrl`/`avatarPreset` defaulted to `null`). UserAvatar falls through to the gradient-hash path, which is the correct visual fallback.

## Gap table

| file:line | expression | type | missing |
|---|---|---|---|
| `apps/web/src/components/gantt/GanttBase.tsx:~533` | `row.assigneeName` | `string \| undefined` on `GanttTaskRow` | `UserSummary` with `id, firstName, lastName, avatarUrl, avatarPreset` |
| `apps/web/src/components/gantt/GanttTooltip.tsx:~130` | `row.assigneeName` | `string \| undefined` on `GanttTaskRow` | `UserSummary` with `id, firstName, lastName, avatarUrl, avatarPreset` |
| `apps/web/src/components/gantt/GanttTooltip.tsx:~165` | `row.managerName` | `string \| undefined` on `GanttPortfolioRow` | `UserSummary` with `id, firstName, lastName, avatarUrl, avatarPreset` |

## Required follow-up (out of V2-E scope)

1. **`apps/web/src/components/gantt/types.ts`** — Replace `assigneeName?: string; assigneeAvatar?: string` on `GanttTaskRow` with `assignee?: UserSummary`. Replace `managerName?: string` on `GanttPortfolioRow` with `manager?: UserSummary`.
2. **Upstream mapper(s)** — Wherever `GanttTaskRow[]` / `GanttPortfolioRow[]` are constructed from API Task/Project payloads, map the enriched `assignee` / `manager` objects (now carrying `avatarUrl` + `avatarPreset` from V4-A) into the new typed fields.
3. **`GanttBase.tsx` + `GanttTooltip.tsx`** — Remove the inline name-split workaround and pass `row.assignee` / `row.manager` directly to `<UserAvatar user={...} />`.
