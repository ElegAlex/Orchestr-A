# Planning Leave Half-Day Visual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `MORNING`/`AFTERNOON` leaves as half-cell overlays in the planning grid (top half = morning, bottom half = afternoon) with a "Matin/Après-midi" mention under the leave type, and show the day's tasks/events in the free half.

**Architecture:** Frontend-only change in `apps/web/src/components/planning/DayCell.tsx`. The leave object already carries `halfDay` from the API (`/planning/overview` loads leaves via Prisma `include:`, which returns all scalar fields). We keep the existing full-day leave overlay untouched, add a separate half-day rendering path (half-height absolute leave block + an absolute free-half zone for tasks/events), and flip the task/event/telework gating so a half-day leave no longer hides the day's work.

**Tech Stack:** Next.js 16 / React 19, Tailwind CSS 4, next-intl, Playwright (E2E).

**Spec:** `docs/superpowers/specs/2026-06-05-planning-leave-half-day-design.md`

---

## File Structure

- `apps/web/messages/fr/planning.json` — add `dayCell.halfDayMorning` / `dayCell.halfDayAfternoon`.
- `apps/web/messages/en/planning.json` — same keys, English.
- `apps/web/src/components/planning/DayCell.tsx` — computed half-day flags, half-height leave overlay + mention, free-half task placement, gating change. This is the only logic file.
- `e2e/tests/workflows/planning-half-day-leave.spec.ts` — new E2E (admin, `@smoke`).

### Reference facts (read before editing)

- `DayCell.tsx:150` — `const leave = cell.leaves[0];` (only the first leave is rendered today).
- `DayCell.tsx:157-158` — `leaveVisible` gates everything (overlay + hides tasks).
- `DayCell.tsx:200-238` — current leave overlay: `absolute inset-0 ... z-10`.
- `DayCell.tsx:264-266` — content wrapper `<div className="relative z-10 space-y-1 ...">` holding telework + tasks + predefined + events.
- Task/event/predefined/telework blocks are each gated by `!leaveVisible && !cell.isHoliday && !hasAllDayEvent` (telework also `!hasAllDayEvent`).
- `HalfDay` enum is exported from `@/types` (`MORNING` / `AFTERNOON`).
- `Leave.halfDay?: HalfDay` and `Leave.status` (`PENDING`) are on the planning leave objects.

---

## Task 1: i18n keys for the morning/afternoon mention

**Files:**
- Modify: `apps/web/messages/fr/planning.json` (the `dayCell` object, ~line 85)
- Modify: `apps/web/messages/en/planning.json` (the `dayCell` object, ~line 85)

- [ ] **Step 1: Add the French keys**

In `apps/web/messages/fr/planning.json`, change the `dayCell` block from:

```json
  "dayCell": {
    "pendingValidation": "en attente de validation",
    "validated": "validé",
    "pending": "En attente",
    "externalShort": "EXT",
    "externalIntervention": "Intervention ext.",
    "allDay": "Journée entière"
  },
```

to:

```json
  "dayCell": {
    "pendingValidation": "en attente de validation",
    "validated": "validé",
    "pending": "En attente",
    "externalShort": "EXT",
    "externalIntervention": "Intervention ext.",
    "allDay": "Journée entière",
    "halfDayMorning": "Matin",
    "halfDayAfternoon": "Après-midi"
  },
```

- [ ] **Step 2: Add the English keys**

In `apps/web/messages/en/planning.json`, change the `dayCell` block to add (after `"allDay": "All day"`):

```json
    "allDay": "All day",
    "halfDayMorning": "Morning",
    "halfDayAfternoon": "Afternoon"
```

(remember to add the comma after `"All day"`).

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "require('./apps/web/messages/fr/planning.json'); require('./apps/web/messages/en/planning.json'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add apps/web/messages/fr/planning.json apps/web/messages/en/planning.json
git commit -m "i18n(planning): add half-day morning/afternoon labels"
```

---

## Task 2: Compute half-day flags in DayCell

**Files:**
- Modify: `apps/web/src/components/planning/DayCell.tsx` (import + just after `leaveVisible`, ~line 158)

- [ ] **Step 1: Import HalfDay**

At the top import from `@/types` (currently `import { Task, TaskStatus } from "@/types";`), change to:

```tsx
import { Task, TaskStatus, HalfDay } from "@/types";
```

- [ ] **Step 2: Add the half-day flags after `leaveVisible`**

Immediately after the `leaveVisible` declaration (line ~158), insert:

```tsx
  // Demi-journée : MORNING = overlay en haut, AFTERNOON = en bas, null = journée entière.
  const leaveHalfDay = leaveVisible ? (leave?.halfDay ?? null) : null;
  const isHalfDayLeave =
    leaveHalfDay === HalfDay.MORNING || leaveHalfDay === HalfDay.AFTERNOON;
  // Un congé journée entière masque tout ; un congé demi-journée laisse l'autre
  // moitié libre pour les tâches/événements.
  const fullDayLeaveVisible = leaveVisible && !isHalfDayLeave;
```

- [ ] **Step 3: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep DayCell || echo "no DayCell type errors"`
Expected: `no DayCell type errors`

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/planning/DayCell.tsx
git commit -m "feat(planning): compute half-day leave flags in DayCell"
```

---

## Task 3: Half-height leave overlay + morning/afternoon mention

**Files:**
- Modify: `apps/web/src/components/planning/DayCell.tsx` (the leave overlay block, lines ~200-238, and the cell wrapper, line ~177)

- [ ] **Step 1: Give the cell a min-height when it shows a half-day leave**

Change the cell wrapper (line ~177-178) from:

```tsx
    <div
      className={`relative overflow-hidden ${viewMode === "month" ? "px-0.5 py-1" : "px-1 py-2"} ${bgClass} ${showWeekSeparator ? "border-l-2 border-l-indigo-400" : ""}`}
```

to:

```tsx
    <div
      className={`relative overflow-hidden ${viewMode === "month" ? "px-0.5 py-1" : "px-1 py-2"} ${isHalfDayLeave ? (viewMode === "month" ? "min-h-[44px]" : "min-h-[96px]") : ""} ${bgClass} ${showWeekSeparator ? "border-l-2 border-l-indigo-400" : ""}`}
```

(The min-height gives the two halves a definite size so `h-1/2` is meaningful.)

- [ ] **Step 2: Gate the existing full-day overlay on `fullDayLeaveVisible`**

Change the leave overlay opener (line ~201) from:

```tsx
      {/* Leave Overlay - couvre toute la cellule */}
      {leaveVisible && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 border-2"
```

to:

```tsx
      {/* Leave Overlay (journée entière) - couvre toute la cellule */}
      {fullDayLeaveVisible && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center z-10 border-2"
```

Leave the rest of that block (icon, name, pending text) unchanged. It now only renders for full-day leaves.

- [ ] **Step 3: Add the half-day leave overlay block**

Immediately AFTER the closing `)}` of the full-day overlay block (after line ~238), insert this new block:

```tsx
      {/* Leave Overlay (demi-journée) - moitié haute (matin) ou basse (après-midi) */}
      {isHalfDayLeave && (
        <div
          className={`absolute inset-x-0 ${leaveHalfDay === HalfDay.MORNING ? "top-0" : "bottom-0"} h-1/2 flex flex-col items-center justify-center z-20 border-2`}
          style={{
            backgroundColor: isPending ? `${leaveColor}26` : `${leaveColor}4D`,
            borderColor: leaveColor,
            borderStyle: isPending ? "dashed" : "solid",
          }}
          title={`${leaveName} — ${
            leaveHalfDay === HalfDay.MORNING
              ? t("dayCell.halfDayMorning")
              : t("dayCell.halfDayAfternoon")
          }${isPending ? ` (${t("dayCell.pendingValidation")})` : ` (${t("dayCell.validated")})`}`}
        >
          <span className={`${viewMode === "month" ? "text-base" : "text-xl"}`}>
            {leaveIcon}
          </span>
          {viewMode === "week" && (
            <>
              <span
                className="font-medium text-[11px] leading-tight"
                style={{ color: leaveColor }}
              >
                {leaveName}
              </span>
              <span
                className="text-[9px] italic leading-tight"
                style={{ color: leaveColor }}
              >
                {leaveHalfDay === HalfDay.MORNING
                  ? t("dayCell.halfDayMorning")
                  : t("dayCell.halfDayAfternoon")}
              </span>
            </>
          )}
        </div>
      )}
```

- [ ] **Step 4: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep DayCell || echo "no DayCell type errors"`
Expected: `no DayCell type errors`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/planning/DayCell.tsx
git commit -m "feat(planning): render half-day leave as half-cell overlay with AM/PM mention"
```

---

## Task 4: Show tasks/events in the free half

The telework/tasks/predefined/events blocks are inside the content wrapper `<div className="relative z-10 space-y-1 ...">` (line ~264) and each is gated by `!leaveVisible`. We flip the gate to `!fullDayLeaveVisible` (so they render under a half-day leave too) and, when half-day, position the whole content wrapper as an absolute zone filling the free half.

**Files:**
- Modify: `apps/web/src/components/planning/DayCell.tsx` (content wrapper line ~264; the four `!leaveVisible` gates at lines ~269, ~296, ~319, ~400; events use `!leaveVisible` at ~489)

- [ ] **Step 1: Replace `!leaveVisible` with `!fullDayLeaveVisible` in the content gates**

There are 5 occurrences of `!leaveVisible &&` used to gate in-cell content (telework toggle ~269, telework read-only ~296, tasks ~319, predefined ~400, events ~489). Replace each of those 5 with `!fullDayLeaveVisible &&`. Do NOT touch the holiday overlay gate at line ~184 (`!leaveVisible`) — keep it as `!leaveVisible` so a half-day leave still suppresses the holiday overlay (current precedence: leave > holiday).

Run this to see the occurrences first:

```bash
grep -n "!leaveVisible" apps/web/src/components/planning/DayCell.tsx
```

Expected lines: ~184 (holiday — KEEP), ~257 (telework bg overlay condition — KEEP, see note), ~269, ~296, ~319, ~400, ~489.

**Note on line ~257:** the telework background overlay condition `!(cell.isExternalIntervention && showExternalIntervention)` is unrelated — do not change. The telework bg overlay itself (line ~243 `!leaveVisible`) should become `!fullDayLeaveVisible` only if you want telework bg under a half-day leave; for this feature KEEP it `!leaveVisible` (telework bg is a full-cell visual that would clash with a half-day leave). So change ONLY the 5 content gates listed above.

After this step, re-grep and confirm exactly the 5 content gates changed:

```bash
grep -n "fullDayLeaveVisible" apps/web/src/components/planning/DayCell.tsx
```

Expected: 5 matches (plus the declaration in Task 2).

- [ ] **Step 2: Position the content wrapper in the free half when half-day**

Change the content wrapper (line ~264-266) from:

```tsx
      <div
        className={`relative z-10 space-y-1 ${viewMode === "month" ? "min-h-[40px]" : "min-h-[60px]"}`}
      >
```

to:

```tsx
      <div
        className={
          isHalfDayLeave
            ? `absolute inset-x-1 ${leaveHalfDay === HalfDay.MORNING ? "bottom-0 top-1/2" : "top-0 bottom-1/2"} z-10 space-y-1 overflow-y-auto`
            : `relative z-10 space-y-1 ${viewMode === "month" ? "min-h-[40px]" : "min-h-[60px]"}`
        }
      >
```

(For a morning leave the content sits in the bottom half; for an afternoon leave, the top half. The free half scrolls if it holds several tasks.)

- [ ] **Step 3: Build the web app to confirm no type/lint break**

Run: `pnpm --filter web build 2>&1 | tail -5`
Expected: build completes (no type errors). If `pnpm --filter web build` is too slow locally, run `cd apps/web && npx tsc --noEmit` instead and expect no new errors in `DayCell.tsx`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/planning/DayCell.tsx
git commit -m "feat(planning): show day tasks/events in the free half of a half-day leave"
```

---

## Task 5: Handle two half-day leaves on the same day (AM + PM)

Today only `cell.leaves[0]` renders. If a user has e.g. a morning CP and an afternoon RTT, render both halves. Keep it minimal: detect a second, opposite half-day leave and render it as a second half overlay.

**Files:**
- Modify: `apps/web/src/components/planning/DayCell.tsx` (after the `leave` declaration ~line 150, and the half-day overlay from Task 3)

- [ ] **Step 1: Derive the opposite half-day leave**

After the half-day flags from Task 2, add:

```tsx
  // Cas rare : deux congés demi-journée le même jour (ex. CP matin + RTT après-midi).
  // On rend chacun dans sa moitié. `leave` (cell.leaves[0]) couvre la 1re moitié ;
  // on cherche un second congé visible de la demi-journée opposée.
  const otherHalfLeave = isHalfDayLeave
    ? cell.leaves.find(
        (l) =>
          l !== leave &&
          l.halfDay &&
          l.halfDay !== leaveHalfDay &&
          (l.status === "PENDING" ? showLeavePending : true),
      )
    : undefined;
```

- [ ] **Step 2: Render the opposite half overlay**

Immediately after the half-day overlay block added in Task 3, insert a second block that renders `otherHalfLeave` in the opposite half. Repeat the same markup but driven by `otherHalfLeave` (do not factor into a helper yet — keep it readable):

```tsx
      {otherHalfLeave && (
        <div
          className={`absolute inset-x-0 ${otherHalfLeave.halfDay === HalfDay.MORNING ? "top-0" : "bottom-0"} h-1/2 flex flex-col items-center justify-center z-20 border-2`}
          style={{
            backgroundColor:
              otherHalfLeave.status === "PENDING"
                ? `${otherHalfLeave.leaveType?.color ?? "#10B981"}26`
                : `${otherHalfLeave.leaveType?.color ?? "#10B981"}4D`,
            borderColor: otherHalfLeave.leaveType?.color ?? "#10B981",
            borderStyle: otherHalfLeave.status === "PENDING" ? "dashed" : "solid",
          }}
        >
          <span className={`${viewMode === "month" ? "text-base" : "text-xl"}`}>
            {otherHalfLeave.leaveType?.icon ?? "🌴"}
          </span>
          {viewMode === "week" && (
            <>
              <span
                className="font-medium text-[11px] leading-tight"
                style={{ color: otherHalfLeave.leaveType?.color ?? "#10B981" }}
              >
                {otherHalfLeave.leaveType?.name ??
                  t(`leaveTypes.${otherHalfLeave.type ?? "OTHER"}`)}
              </span>
              <span
                className="text-[9px] italic leading-tight"
                style={{ color: otherHalfLeave.leaveType?.color ?? "#10B981" }}
              >
                {otherHalfLeave.halfDay === HalfDay.MORNING
                  ? t("dayCell.halfDayMorning")
                  : t("dayCell.halfDayAfternoon")}
              </span>
            </>
          )}
        </div>
      )}
```

- [ ] **Step 3: Hide the free-half content when both halves are leaves**

When `otherHalfLeave` exists, both halves are occupied, so tasks should not render. Change the content wrapper gate. The content wrapper from Task 4 Step 2 currently always renders; wrap it so it does not render when `otherHalfLeave` is set. The simplest: in each of the 5 content gates from Task 4 Step 1, the condition already starts with `!fullDayLeaveVisible`. Add `&& !otherHalfLeave` to those 5 gates as well, e.g.:

```tsx
        {!fullDayLeaveVisible &&
          !otherHalfLeave &&
          !cell.isHoliday &&
          !hasAllDayEvent &&
          ...
```

- [ ] **Step 4: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep DayCell || echo "no DayCell type errors"`
Expected: `no DayCell type errors`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/planning/DayCell.tsx
git commit -m "feat(planning): render two opposite half-day leaves on the same day"
```

---

## Task 6: E2E test — morning leave renders top half, task stays visible

**Files:**
- Create: `e2e/tests/workflows/planning-half-day-leave.spec.ts`

This mirrors `e2e/tests/workflows/planning-external-task.spec.ts` (admin project, API auth via localStorage token, current-Monday date, cleanup in `afterEach`) plus the leave-creation pattern from `e2e/tests/workflows/leaves.spec.ts`.

Key API facts (verified — do NOT change without re-checking):
- `POST /api/leaves` requires `leaveTypeId` (a LeaveTypeConfig id), NOT the `type` enum. Get it from `GET /api/leave-types` and pick the one with `code === "OTHER"` (no balance gate → unconditional 201). `halfDay: "MORNING"` makes it a half-day.
- A leave can be declared for another user via `targetUserId` (admin has `leaves:declare_for_others`). It is created `PENDING`; approve it via `POST /api/leaves/{id}/approve` so it becomes `APPROVED` → a **validated** leave is always visible regardless of the "pending" legend filter.
- The user must be planning-visible (active + in a service). Find one from `GET /api/planning/overview` exactly like the external-task test (mirrors the server filter).
- Assign the same user as the task assignee so both land on the same planning row.

- [ ] **Step 1: Write the test file**

```ts
/**
 * e2e/tests/workflows/planning-half-day-leave.spec.ts
 *
 * Vérifie le rendu demi-journée d'un congé dans la grille planning :
 * un congé MORNING (validé) occupe la moitié haute de la cellule, et une
 * tâche du même jour reste visible (moitié basse). Régression de la feature
 * "visuel demi-journée des congés".
 */

import { test, expect } from "../../fixtures/test-fixtures";

interface OverviewUser {
  id: string;
  isActive?: boolean;
  userServices?: unknown[];
}

function currentMondayNoon(): Date {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(12, 0, 0, 0);
  return monday;
}

test.describe("Planning — congé demi-journée", () => {
  let createdTaskId: string | null = null;
  let createdLeaveId: string | null = null;
  let authHeaders: Record<string, string> = {};

  test.afterEach(async ({ page }) => {
    if (createdTaskId) {
      await page.request
        .delete(`/api/tasks/${createdTaskId}`, { headers: authHeaders })
        .catch(() => {});
      createdTaskId = null;
    }
    if (createdLeaveId) {
      await page.request
        .delete(`/api/leaves/${createdLeaveId}`, { headers: authHeaders })
        .catch(() => {});
      createdLeaveId = null;
    }
  });

  test("un congé du matin occupe la moitié haute et laisse la tâche visible @smoke", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "admin",
      "Scénario création/rendu exécuté uniquement sous le projet admin",
    );

    await page.goto("/fr/planning");
    const token = await page.evaluate(() =>
      localStorage.getItem("access_token"),
    );
    expect(token, "JWT admin présent").toBeTruthy();
    authHeaders = { Authorization: `Bearer ${token}` };

    const monday = currentMondayNoon();
    const mondayISO = monday.toISOString();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // 1. Utilisateur visible dans le planning (actif + service) — même filtre serveur.
    const overviewRes = await page.request.get(
      `/api/planning/overview?startDate=${mondayISO}&endDate=${sunday.toISOString()}`,
      { headers: authHeaders },
    );
    expect(overviewRes.ok(), "GET /planning/overview OK").toBeTruthy();
    const overview = await overviewRes.json();
    const visibleUser = (overview.users as OverviewUser[]).find(
      (u) =>
        u?.isActive !== false &&
        Array.isArray(u?.userServices) &&
        u.userServices.length > 0,
    );
    expect(visibleUser, "au moins un utilisateur visible").toBeTruthy();

    // 2. Type de congé OTHER (pas de jauge de solde → 201 inconditionnel).
    const typesRes = await page.request.get(`/api/leave-types`, {
      headers: authHeaders,
    });
    expect(typesRes.ok(), "GET /leave-types OK").toBeTruthy();
    const types = (await typesRes.json()) as { id: string; code: string }[];
    const otherType = types.find((t) => t.code === "OTHER");
    expect(otherType, "type de congé OTHER présent").toBeTruthy();

    // 3. Déclarer un congé MORNING pour l'utilisateur visible, puis l'approuver
    //    (APPROVED = validé = toujours affiché, indépendant du filtre "en attente").
    const leaveRes = await page.request.post(`/api/leaves`, {
      headers: authHeaders,
      data: {
        leaveTypeId: otherType!.id,
        targetUserId: visibleUser!.id,
        startDate: mondayISO,
        endDate: mondayISO,
        halfDay: "MORNING",
        reason: "E2E half-day",
      },
    });
    expect(
      leaveRes.ok(),
      `POST /leaves OK (${leaveRes.status()})`,
    ).toBeTruthy();
    createdLeaveId = (await leaveRes.json()).id as string;

    const approveRes = await page.request.post(
      `/api/leaves/${createdLeaveId}/approve`,
      { headers: authHeaders },
    );
    expect(
      approveRes.ok(),
      `approve OK (${approveRes.status()})`,
    ).toBeTruthy();

    // 4. Une tâche le même jour, assignée au même utilisateur.
    const title = `E2E-HALF-${Date.now()}`;
    const taskRes = await page.request.post(`/api/tasks`, {
      headers: authHeaders,
      data: {
        title,
        status: "TODO",
        priority: "NORMAL",
        projectId: null,
        assigneeIds: [visibleUser!.id],
        startDate: mondayISO,
        endDate: mondayISO,
      },
    });
    expect(
      taskRes.ok(),
      `POST /tasks OK (${taskRes.status()})`,
    ).toBeTruthy();
    createdTaskId = (await taskRes.json()).id as string;

    // 5. Charger le planning et vérifier.
    await page.goto("/fr/planning");
    await expect(
      page.getByRole("heading", { name: "Planning des Ressources", level: 1 }),
    ).toBeVisible({ timeout: 15000 });

    // La tâche reste visible (la moitié libre montre le travail).
    const card = page.locator("div.cursor-move").filter({ hasText: title });
    await expect(card.first()).toBeVisible({ timeout: 15000 });

    // L'overlay congé demi-journée est en moitié haute (classes h-1/2 + top-0 + z-20).
    const morningOverlay = page.locator('div.h-1\\/2.top-0[class*="z-20"]');
    await expect(morningOverlay.first()).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Verify the test is discovered and compiles**

Run: `npx playwright test --list -g "congé du matin occupe la moitié haute"`
Expected: lists the test under the role projects, no compile error.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/planning-half-day-leave.spec.ts
git commit -m "test(e2e): half-day morning leave renders top half, task stays visible"
```

---

## Task 7: Manual visual verification

CSS half-cell layout is sensitive; confirm it looks right in a real browser before declaring done.

**Files:** none (verification only)

- [ ] **Step 1: Start the stack and open the planning**

Run the app locally (`pnpm run docker:dev` for DB/Redis if not up, then `pnpm run dev`). Log in (`admin` / `admin123`).

- [ ] **Step 2: Create the test data via the UI or seed**

Create, for a user visible in the planning (active + in a service): a `MORNING` half-day leave on a weekday, plus a task the same day. Repeat with an `AFTERNOON` leave for another day/user.

- [ ] **Step 3: Visually confirm against the spec**

Check, in week view:
- Morning leave → green block in the **top half**, "Matin" under the type name; the task visible in the **bottom half**.
- Afternoon leave → block in the **bottom half**, "Après-midi"; task visible in the **top half**.
- Full-day leave (no `halfDay`) → unchanged, covers the whole cell, hides tasks.
- Month view → half-positioned icon, no AM/PM text, not visually broken.

Take a screenshot of a morning and an afternoon cell for the record.

- [ ] **Step 4: No commit** (verification only). If spacing/scroll needs tweaks, adjust Task 3/4 classes and re-commit under those tasks.

---

## Self-Review notes

- **Spec §1 (overlay by halfDay + mention):** Task 3.
- **Spec §2 (free half shows work, full-day unchanged, no time filter, scrollable):** Task 4.
- **Spec §3 month view / two half-days / holiday precedence:** Task 3 Step 1 (month min-h + Task 3 Step 3 month-no-text), Task 5 (two half-days), Task 4 Step 1 note (holiday gate kept on `!leaveVisible`).
- **Spec §4 testing:** Task 6 (E2E), Task 7 (manual visual).
- **Type consistency:** `leaveHalfDay`, `isHalfDayLeave`, `fullDayLeaveVisible`, `otherHalfLeave` defined in Tasks 2/5 and used consistently; `HalfDay.MORNING`/`HalfDay.AFTERNOON` from `@/types`.
- **No back changes** — confirmed `halfDay` already in the planning payload.
