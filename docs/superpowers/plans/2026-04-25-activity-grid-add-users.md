# Activity Grid — Bouton `+` inversé multi-agents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton `+ Ajouter` dans chaque cellule de l'`ActivityGrid` (Vue activité) qui ouvre une modale multi-sélection d'agents, créant N assignations en un appel `bulkAssign`.

**Architecture:** Composant React modal isolé (`AddUsersToTaskModal`) consommé par `ActivityGrid` via callback `onAddUsers(taskId, date)`. Wiring dans `PlanningView` (state local + handler + gating perm). Réutilisation pure de l'endpoint backend `POST /predefined-tasks/assignments/bulk` existant et de la perm `predefined_tasks:assign`. Aucun changement backend, aucune migration RBAC.

**Tech Stack:** React 19, Next.js 16, Tailwind 4, next-intl, TanStack Query, Jest + RTL (unit), Playwright (E2E), date-fns.

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `apps/web/messages/fr/planning.json` | MODIFY | Clés i18n FR pour modal + bouton |
| `apps/web/messages/en/planning.json` | MODIFY | Clés i18n EN pour modal + bouton |
| `apps/web/src/components/planning/AddUsersToTaskModal.tsx` | CREATE | Modale multi-sélection agents |
| `apps/web/src/components/planning/__tests__/AddUsersToTaskModal.test.tsx` | CREATE | Tests Jest unitaires modale |
| `apps/web/src/components/planning/ActivityGrid.tsx` | MODIFY | Bouton `+ Ajouter`, props `canAssign`/`leaves`/`onAddUsers` |
| `apps/web/src/components/planning/__tests__/ActivityGrid.test.tsx` | MODIFY | Cas tests pour bouton `+` |
| `apps/web/src/components/planning/PlanningView.tsx` | MODIFY | State `addUsersTarget`, handler, gating perm, render modale |
| `e2e/tests/activity-grid-add-users.spec.ts` | CREATE | E2E Playwright multi-rôles |

---

## Task 1 : i18n keys (fr + en)

**Files:**
- Modify: `apps/web/messages/fr/planning.json`
- Modify: `apps/web/messages/en/planning.json`

- [ ] **Step 1.1: Étendre `activityGrid` block dans fr/planning.json**

Remplacer le bloc `activityGrid` actuel (lignes 170-177 environ) par :

```json
  "activityGrid": {
    "caption": "Grille d'activité — jours en lignes, tâches en colonnes",
    "dateCol": "Jour",
    "emptyCell": "—",
    "moreUsers": "+{count}",
    "print": "Imprimer",
    "emptyState": "Aucune tâche prédéfinie active",
    "addUsers": "Ajouter",
    "addUsersModal": {
      "title": "Ajouter des agents",
      "subtitle": "{taskName} · {date}",
      "alreadyAssigned": "déjà assigné",
      "onLeave": "en congé · {type}",
      "noEligibleUsers": "Tous les agents sont déjà assignés ou en congé ce jour.",
      "selectedCount": "{count} agent(s) sélectionné(s)",
      "submit": "Ajouter ({count})",
      "submitting": "Ajout en cours…",
      "cancel": "Annuler",
      "successToast": "{count} assignation(s) créée(s)",
      "errorToast": "Erreur lors de l'ajout"
    }
  }
```

- [ ] **Step 1.2: Étendre `activityGrid` block dans en/planning.json**

Calquer la même structure côté anglais (traduction directe) :

```json
  "activityGrid": {
    "caption": "Activity grid — days as rows, tasks as columns",
    "dateCol": "Day",
    "emptyCell": "—",
    "moreUsers": "+{count}",
    "print": "Print",
    "emptyState": "No active predefined task",
    "addUsers": "Add",
    "addUsersModal": {
      "title": "Add agents",
      "subtitle": "{taskName} · {date}",
      "alreadyAssigned": "already assigned",
      "onLeave": "on leave · {type}",
      "noEligibleUsers": "All agents are already assigned or on leave this day.",
      "selectedCount": "{count} agent(s) selected",
      "submit": "Add ({count})",
      "submitting": "Adding…",
      "cancel": "Cancel",
      "successToast": "{count} assignment(s) created",
      "errorToast": "Error while adding"
    }
  }
```

> Note : si la version EN actuelle a un libellé différent pour `caption`/`dateCol`/`emptyState`, conserver l'existant et n'ajouter que les nouvelles clés `addUsers` et `addUsersModal`.

- [ ] **Step 1.3: Vérifier le JSON est valide**

Run: `node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/fr/planning.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('apps/web/messages/en/planning.json','utf8'))"`
Expected: aucune sortie (pas d'erreur), les deux fichiers sont valides.

- [ ] **Step 1.4: Commit**

```bash
git add apps/web/messages/fr/planning.json apps/web/messages/en/planning.json
git commit -m "i18n(planning): clés addUsers + addUsersModal pour Vue activité"
```

---

## Task 2 : AddUsersToTaskModal — composant + tests

**Files:**
- Create: `apps/web/src/components/planning/AddUsersToTaskModal.tsx`
- Create: `apps/web/src/components/planning/__tests__/AddUsersToTaskModal.test.tsx`

- [ ] **Step 2.1: Écrire le test "rend la liste d'agents triée par lastName"**

Créer `apps/web/src/components/planning/__tests__/AddUsersToTaskModal.test.tsx` :

```tsx
/**
 * AddUsersToTaskModal.test.tsx — Vue activité, bouton + inversé
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddUsersToTaskModal } from "../AddUsersToTaskModal";
import { predefinedTasksService } from "@/services/predefined-tasks.service";
import type { PredefinedTask, PredefinedTaskAssignment } from "@/services/predefined-tasks.service";
import type { UserSummary, Leave } from "@/types";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, string | number>) => {
    const dict: Record<string, string> = {
      "activityGrid.addUsersModal.title": "Ajouter des agents",
      "activityGrid.addUsersModal.alreadyAssigned": "déjà assigné",
      "activityGrid.addUsersModal.noEligibleUsers": "Tous les agents sont déjà assignés ou en congé ce jour.",
      "activityGrid.addUsersModal.cancel": "Annuler",
      "activityGrid.addUsersModal.submitting": "Ajout en cours…",
      "activityGrid.addUsersModal.errorToast": "Erreur lors de l'ajout",
    };
    if (key === "activityGrid.addUsersModal.subtitle" && params) {
      return `${params.taskName} · ${params.date}`;
    }
    if (key === "activityGrid.addUsersModal.onLeave" && params) {
      return `en congé · ${params.type}`;
    }
    if (key === "activityGrid.addUsersModal.selectedCount" && params) {
      return `${params.count} agent(s) sélectionné(s)`;
    }
    if (key === "activityGrid.addUsersModal.submit" && params) {
      return `Ajouter (${params.count})`;
    }
    if (key === "activityGrid.addUsersModal.successToast" && params) {
      return `${params.count} assignation(s) créée(s)`;
    }
    return dict[key] ?? key;
  },
}));

jest.mock("@/components/UserAvatar", () => ({
  UserAvatar: ({ user }: { user: UserSummary }) => (
    <span data-testid="avatar">{user.firstName?.[0]}{user.lastName?.[0]}</span>
  ),
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/services/predefined-tasks.service", () => ({
  predefinedTasksService: {
    bulkAssign: jest.fn(),
  },
}));

const buildUser = (id: string, firstName: string, lastName: string): UserSummary =>
  ({ id, firstName, lastName, isActive: true }) as UserSummary;

const buildTask = (overrides: Partial<PredefinedTask> = {}): PredefinedTask =>
  ({
    id: "t1",
    name: "Permanence accueil",
    description: null,
    color: "#3B82F6",
    icon: "📋",
    defaultDuration: "FULL_DAY",
    isExternalIntervention: false,
    isActive: true,
    weight: 2,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  }) as PredefinedTask;

const buildAssignment = (id: string, userId: string): PredefinedTaskAssignment =>
  ({
    id,
    predefinedTaskId: "t1",
    userId,
    date: "2026-05-12",
    period: "FULL_DAY",
    createdById: "u-creator",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }) as PredefinedTaskAssignment;

const buildLeave = (
  userId: string,
  startDate: string,
  endDate: string,
  status: "APPROVED" | "PENDING" = "APPROVED",
  typeCode = "CA",
): Leave =>
  ({
    id: `leave-${userId}`,
    userId,
    startDate,
    endDate,
    status,
    type: typeCode,
    leaveType: { code: typeCode, name: typeCode } as Leave["leaveType"],
  }) as Leave;

describe("AddUsersToTaskModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("liste les agents triés par lastName ascendant", () => {
    const users = [
      buildUser("u1", "Paul", "Zelda"),
      buildUser("u2", "Marie", "Alpha"),
      buildUser("u3", "Karim", "Mid"),
    ];
    render(
      <AddUsersToTaskModal
        task={buildTask()}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    const items = screen.getAllByRole("checkbox");
    // 3 checkboxes dans l'ordre : Alpha, Mid, Zelda (sort par lastName)
    expect(items[0]).toHaveAttribute("data-user-id", "u2");
    expect(items[1]).toHaveAttribute("data-user-id", "u3");
    expect(items[2]).toHaveAttribute("data-user-id", "u1");
  });
});
```

- [ ] **Step 2.2: Run le test (fail attendu)**

Run: `pnpm --filter web test -- AddUsersToTaskModal --watch=false`
Expected: FAIL — `AddUsersToTaskModal` non défini.

- [ ] **Step 2.3: Implémenter le composant minimal**

Créer `apps/web/src/components/planning/AddUsersToTaskModal.tsx` :

```tsx
"use client";

import { useMemo, useState } from "react";
import { format, isWithinInterval, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { UserAvatar } from "@/components/UserAvatar";
import {
  predefinedTasksService,
  type PredefinedTask,
  type PredefinedTaskAssignment,
  type TaskDuration,
} from "@/services/predefined-tasks.service";
import type { UserSummary, Leave } from "@/types";

export interface AddUsersToTaskModalProps {
  task: PredefinedTask;
  date: Date;
  allUsers: UserSummary[];
  existingAssignments: PredefinedTaskAssignment[];
  leaves: Leave[];
  onClose: () => void;
  onSuccess: () => void;
}

type EligibilityStatus = "eligible" | "already_assigned" | "on_leave";

interface EligibilityInfo {
  status: EligibilityStatus;
  leaveType?: string;
}

function computeEligibility(
  user: UserSummary,
  existingAssignments: PredefinedTaskAssignment[],
  leaves: Leave[],
  date: Date,
): EligibilityInfo {
  if (existingAssignments.some((a) => a.userId === user.id)) {
    return { status: "already_assigned" };
  }
  const userLeave = leaves.find((l) => {
    if (l.userId !== user.id) return false;
    if (l.status !== "APPROVED") return false;
    try {
      return isWithinInterval(date, {
        start: parseISO(l.startDate),
        end: parseISO(l.endDate),
      });
    } catch {
      return false;
    }
  });
  if (userLeave) {
    const leaveTypeCode =
      userLeave.leaveType?.code ?? userLeave.type ?? "OTHER";
    return { status: "on_leave", leaveType: leaveTypeCode };
  }
  return { status: "eligible" };
}

function toPeriod(
  duration: TaskDuration,
): "MORNING" | "AFTERNOON" | "FULL_DAY" {
  if (duration === "HALF_DAY") return "MORNING";
  return "FULL_DAY";
}

export function AddUsersToTaskModal({
  task,
  date,
  allUsers,
  existingAssignments,
  leaves,
  onClose,
  onSuccess,
}: AddUsersToTaskModalProps) {
  const t = useTranslations("planning");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);

  const sortedUsers = useMemo(
    () =>
      [...allUsers].sort((a, b) =>
        (a.lastName ?? "").localeCompare(b.lastName ?? "", "fr"),
      ),
    [allUsers],
  );

  const eligibility = useMemo(() => {
    const map = new Map<string, EligibilityInfo>();
    for (const u of sortedUsers) {
      map.set(u.id, computeEligibility(u, existingAssignments, leaves, date));
    }
    return map;
  }, [sortedUsers, existingAssignments, leaves, date]);

  const eligibleCount = useMemo(
    () =>
      sortedUsers.filter(
        (u) => eligibility.get(u.id)?.status === "eligible",
      ).length,
    [sortedUsers, eligibility],
  );

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedUserIds.size === 0) return;
    setSubmitting(true);
    try {
      await predefinedTasksService.bulkAssign({
        predefinedTaskId: task.id,
        userIds: Array.from(selectedUserIds),
        dates: [format(date, "yyyy-MM-dd")],
        period: toPeriod(task.defaultDuration),
      });
      toast.success(
        t("activityGrid.addUsersModal.successToast", {
          count: selectedUserIds.size,
        }),
      );
      onSuccess();
      onClose();
    } catch {
      toast.error(t("activityGrid.addUsersModal.errorToast"));
    } finally {
      setSubmitting(false);
    }
  };

  const dateLabel = format(date, "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t("activityGrid.addUsersModal.title")}
            </h2>
            <p className="text-sm text-gray-500">
              {t("activityGrid.addUsersModal.subtitle", {
                taskName: task.name,
                date: dateLabel,
              })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label={t("activityGrid.addUsersModal.cancel")}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        {eligibleCount === 0 &&
        sortedUsers.every(
          (u) => eligibility.get(u.id)?.status !== "eligible",
        ) ? (
          <p className="text-sm text-gray-500 italic text-center py-8">
            {t("activityGrid.addUsersModal.noEligibleUsers")}
          </p>
        ) : (
          <ul
            className="space-y-1 max-h-80 overflow-y-auto"
            role="list"
          >
            {sortedUsers.map((user) => {
              const info = eligibility.get(user.id)!;
              const isAlreadyAssigned = info.status === "already_assigned";
              const isOnLeave = info.status === "on_leave";
              const disabled = isAlreadyAssigned || isOnLeave;
              const checked = isAlreadyAssigned || selectedUserIds.has(user.id);
              const firstName = user.firstName ?? "";
              const lastName = (user.lastName ?? "").toUpperCase();
              return (
                <li
                  key={user.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded ${disabled ? "opacity-50" : "hover:bg-blue-50 cursor-pointer"}`}
                  onClick={() => !disabled && toggleUser(user.id)}
                >
                  <input
                    type="checkbox"
                    data-user-id={user.id}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => !disabled && toggleUser(user.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-blue-600"
                  />
                  <UserAvatar user={user} size="sm" />
                  <span className="flex-1 min-w-0 text-sm">
                    <span className="font-normal text-zinc-700">
                      {firstName}
                    </span>{" "}
                    <span className="font-semibold text-zinc-900">
                      {lastName}
                    </span>
                  </span>
                  {isAlreadyAssigned && (
                    <span className="text-xs italic text-gray-400">
                      {t("activityGrid.addUsersModal.alreadyAssigned")}
                    </span>
                  )}
                  {isOnLeave && (
                    <span className="text-xs italic text-gray-400">
                      {t("activityGrid.addUsersModal.onLeave", {
                        type: info.leaveType ?? "",
                      })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <span className="text-xs text-gray-500">
            {t("activityGrid.addUsersModal.selectedCount", {
              count: selectedUserIds.size,
            })}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {t("activityGrid.addUsersModal.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedUserIds.size === 0 || submitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? t("activityGrid.addUsersModal.submitting")
                : t("activityGrid.addUsersModal.submit", {
                    count: selectedUserIds.size,
                  })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.4: Run le test (pass attendu)**

Run: `pnpm --filter web test -- AddUsersToTaskModal --watch=false`
Expected: 1 test PASS (« liste les agents triés par lastName »).

- [ ] **Step 2.5: Ajouter le test "désactive les déjà-assignés"**

Ajouter dans `__tests__/AddUsersToTaskModal.test.tsx` à l'intérieur du `describe` :

```tsx
  it("coche + désactive les agents déjà assignés", () => {
    const users = [buildUser("u1", "Paul", "Lemoine")];
    render(
      <AddUsersToTaskModal
        task={buildTask()}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[buildAssignment("a1", "u1")]}
        leaves={[]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText("déjà assigné")).toBeInTheDocument();
  });
```

- [ ] **Step 2.6: Run le test (pass attendu)**

Run: `pnpm --filter web test -- AddUsersToTaskModal --watch=false`
Expected: 2 tests PASS.

- [ ] **Step 2.7: Ajouter le test "grise les agents en congé validé"**

Ajouter :

```tsx
  it("désactive les agents en congé validé avec le type", () => {
    const users = [buildUser("u1", "Marie", "Dupont")];
    render(
      <AddUsersToTaskModal
        task={buildTask()}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[buildLeave("u1", "2026-05-10", "2026-05-15")]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText("en congé · CA")).toBeInTheDocument();
  });

  it("ignore les congés PENDING (non bloquants)", () => {
    const users = [buildUser("u1", "Marie", "Dupont")];
    render(
      <AddUsersToTaskModal
        task={buildTask()}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[buildLeave("u1", "2026-05-10", "2026-05-15", "PENDING")]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
  });
```

- [ ] **Step 2.8: Run les tests (pass attendu)**

Run: `pnpm --filter web test -- AddUsersToTaskModal --watch=false`
Expected: 4 tests PASS.

- [ ] **Step 2.9: Ajouter les tests "submit + bouton + état vide"**

Ajouter :

```tsx
  it("bouton Ajouter reflète la taille de sélection et est désactivé si N=0", () => {
    const users = [
      buildUser("u1", "Marie", "Dupont"),
      buildUser("u2", "Paul", "Lemoine"),
    ];
    render(
      <AddUsersToTaskModal
        task={buildTask()}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    const submitBtn = screen.getByRole("button", { name: /Ajouter \(0\)/ });
    expect(submitBtn).toBeDisabled();
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(
      screen.getByRole("button", { name: /Ajouter \(1\)/ }),
    ).not.toBeDisabled();
  });

  it("submit appelle bulkAssign avec la bonne forme et FULL_DAY par défaut", async () => {
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    (predefinedTasksService.bulkAssign as jest.Mock).mockResolvedValue({});
    const users = [buildUser("u1", "Marie", "Dupont")];
    render(
      <AddUsersToTaskModal
        task={buildTask({ defaultDuration: "FULL_DAY" })}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[]}
        onClose={onClose}
        onSuccess={onSuccess}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter \(1\)/ }));
    await waitFor(() =>
      expect(predefinedTasksService.bulkAssign).toHaveBeenCalledWith({
        predefinedTaskId: "t1",
        userIds: ["u1"],
        dates: ["2026-05-12"],
        period: "FULL_DAY",
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("submit envoie period=MORNING pour HALF_DAY", async () => {
    (predefinedTasksService.bulkAssign as jest.Mock).mockResolvedValue({});
    const users = [buildUser("u1", "Marie", "Dupont")];
    render(
      <AddUsersToTaskModal
        task={buildTask({ defaultDuration: "HALF_DAY" })}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Ajouter \(1\)/ }));
    await waitFor(() =>
      expect(predefinedTasksService.bulkAssign).toHaveBeenCalledWith(
        expect.objectContaining({ period: "MORNING" }),
      ),
    );
  });

  it("affiche état vide si tous les agents sont assignés ou en congé", () => {
    const users = [
      buildUser("u1", "Marie", "Dupont"),
      buildUser("u2", "Paul", "Lemoine"),
    ];
    render(
      <AddUsersToTaskModal
        task={buildTask()}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[buildAssignment("a1", "u1")]}
        leaves={[buildLeave("u2", "2026-05-10", "2026-05-15")]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    expect(
      screen.getByText(
        "Tous les agents sont déjà assignés ou en congé ce jour.",
      ),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2.10: Run la suite complète AddUsersToTaskModal (pass attendu)**

Run: `pnpm --filter web test -- AddUsersToTaskModal --watch=false`
Expected: 8 tests PASS.

- [ ] **Step 2.11: Commit**

```bash
git add apps/web/src/components/planning/AddUsersToTaskModal.tsx \
        apps/web/src/components/planning/__tests__/AddUsersToTaskModal.test.tsx
git commit -m "feat(planning): AddUsersToTaskModal — modale multi-sélection agents"
```

---

## Task 3 : ActivityGrid — bouton `+ Ajouter`

**Files:**
- Modify: `apps/web/src/components/planning/ActivityGrid.tsx`
- Modify: `apps/web/src/components/planning/__tests__/ActivityGrid.test.tsx`

- [ ] **Step 3.1: Ajouter le test "+ Ajouter rendu si canAssign && !isOffDay"**

Dans `__tests__/ActivityGrid.test.tsx`, étendre le mock de `useTranslations` pour inclure la clé `activityGrid.addUsers` :

Remplacer dans le mock `useTranslations` la const `dict` par :

```tsx
      const dict: Record<string, string> = {
        "activityGrid.caption": "Grille d'activité",
        "activityGrid.dateCol": "Jour",
        "activityGrid.emptyCell": "—",
        "activityGrid.print": "Imprimer",
        "activityGrid.emptyState": "Aucune tâche prédéfinie active",
        "activityGrid.addUsers": "Ajouter",
      };
```

Puis ajouter à l'intérieur du `describe("ActivityGrid", ...)` :

```tsx
  it("+ Ajouter rendu dans cellule vide si canAssign et jour ouvré", () => {
    const onAddUsers = jest.fn();
    render(
      <ActivityGrid
        days={[day("2026-04-22")]} // mercredi
        tasks={[buildTask("t1", "Permanence")]}
        assignments={[]}
        users={[]}
        leaves={[]}
        canAssign
        onAddUsers={onAddUsers}
      />,
    );
    const btn = screen.getByRole("button", { name: /ajouter/i });
    fireEvent.click(btn);
    expect(onAddUsers).toHaveBeenCalledWith("t1", "2026-04-22");
  });

  it("+ Ajouter rendu dans cellule pleine après la liste agents", () => {
    const u1 = buildUser("u1", "Marie", "Dupont");
    render(
      <ActivityGrid
        days={[day("2026-04-22")]}
        tasks={[buildTask("t1", "Permanence")]}
        assignments={[buildAssignment("a1", "t1", "u1", "2026-04-22")]}
        users={[u1]}
        leaves={[]}
        canAssign
        onAddUsers={jest.fn()}
      />,
    );
    expect(screen.getByText("DUPONT")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ajouter/i }),
    ).toBeInTheDocument();
  });

  it("+ Ajouter NON rendu si canAssign=false", () => {
    render(
      <ActivityGrid
        days={[day("2026-04-22")]}
        tasks={[buildTask("t1", "Permanence")]}
        assignments={[]}
        users={[]}
        leaves={[]}
        canAssign={false}
        onAddUsers={jest.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /ajouter/i }),
    ).not.toBeInTheDocument();
  });

  it("+ Ajouter NON rendu sur weekend ou férié", () => {
    render(
      <ActivityGrid
        days={[day("2026-04-25")]} // samedi
        tasks={[buildTask("t1", "Permanence")]}
        assignments={[]}
        users={[]}
        leaves={[]}
        canAssign
        onAddUsers={jest.fn()}
        isWeekend={(d) => [0, 6].includes(d.getDay())}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /ajouter/i }),
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 3.2: Run les tests (fail attendu — props et bouton manquants)**

Run: `pnpm --filter web test -- ActivityGrid --watch=false`
Expected: les 4 nouveaux tests FAIL (pas de prop `canAssign`/`onAddUsers`/`leaves`, pas de bouton).

- [ ] **Step 3.3: Étendre `ActivityGridProps` et le rendu**

Dans `apps/web/src/components/planning/ActivityGrid.tsx`, modifier l'interface props et le rendu cellule.

Remplacer le bloc `interface ActivityGridProps` :

```tsx
export interface ActivityGridProps {
  days: Date[];
  tasks: PredefinedTask[];
  assignments: PredefinedTaskAssignment[];
  users: UserSummary[];
  leaves?: Leave[];
  canAssign?: boolean;
  onAddUsers?: (taskId: string, dateIso: string) => void;
  isHoliday?: (date: Date) => boolean;
  isWeekend?: (date: Date) => boolean;
}
```

Ajouter `import type { Leave } from "@/types";` en haut du fichier (au même endroit que `UserSummary`).

Modifier la signature du composant :

```tsx
export function ActivityGrid({
  days,
  tasks,
  assignments,
  users,
  leaves: _leaves,
  canAssign = false,
  onAddUsers,
  isHoliday,
  isWeekend,
}: ActivityGridProps) {
```

> Note : `leaves` n'est pas utilisé dans `ActivityGrid` lui-même (seulement transmis via le parent à la modale), donc on peut l'accepter en prop mais le préfixer `_leaves` pour signaler l'usage downstream-only.

Dans la cellule **vide** (où l'on retourne `<td>...emptyCell...</td>`), remplacer le contenu par :

```tsx
                    if (cellAssignments.length === 0) {
                      return (
                        <td
                          key={task.id}
                          className={`px-3 py-3 text-zinc-300 text-center bg-zinc-50${
                            colIdx < tasks.length - 1
                              ? " border-r border-zinc-100"
                              : ""
                          }`}
                        >
                          {canAssign && onAddUsers ? (
                            <button
                              type="button"
                              onClick={() => onAddUsers(task.id, dateIso)}
                              className="no-print text-xs text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded px-2 py-0.5 transition"
                            >
                              + {t("activityGrid.addUsers" as Parameters<typeof t>[0])}
                            </button>
                          ) : (
                            t("activityGrid.emptyCell" as Parameters<typeof t>[0])
                          )}
                        </td>
                      );
                    }
```

Et dans la cellule **pleine** (le `<td>` qui contient la `<ul>`), ajouter à la fin de la liste un `<li>` bouton :

```tsx
                    return (
                      <td
                        key={task.id}
                        className={`px-3 py-2 align-top${
                          colIdx < tasks.length - 1
                            ? " border-r border-zinc-100"
                            : ""
                        }`}
                      >
                        <ul className="space-y-0.5">
                          {visible.map((u) => (
                            <UserRowItem key={u.id} user={u} />
                          ))}
                          {overflow > 0 && (
                            <li className="pl-7 text-[10px] text-zinc-500 italic">
                              {t("activityGrid.moreUsers" as Parameters<typeof t>[0], {
                                count: overflow,
                              })}
                            </li>
                          )}
                          {canAssign && onAddUsers && (
                            <li className="no-print pt-1">
                              <button
                                type="button"
                                onClick={() => onAddUsers(task.id, dateIso)}
                                className="text-xs text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded px-2 py-0.5 transition"
                              >
                                + {t("activityGrid.addUsers" as Parameters<typeof t>[0])}
                              </button>
                            </li>
                          )}
                        </ul>
                      </td>
                    );
```

- [ ] **Step 3.4: Run les tests (pass attendu)**

Run: `pnpm --filter web test -- ActivityGrid --watch=false`
Expected: tous les tests PASS (anciens + 4 nouveaux).

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/components/planning/ActivityGrid.tsx \
        apps/web/src/components/planning/__tests__/ActivityGrid.test.tsx
git commit -m "feat(planning): bouton + Ajouter dans ActivityGrid (Vue activité)"
```

---

## Task 4 : PlanningView — wiring modale

**Files:**
- Modify: `apps/web/src/components/planning/PlanningView.tsx`

- [ ] **Step 4.1: Ajouter import et state pour la modale**

Au début de `PlanningView.tsx`, ajouter l'import :

```tsx
import { AddUsersToTaskModal } from "./AddUsersToTaskModal";
```

Dans le corps du composant (après les autres `useState`), ajouter :

```tsx
  const [addUsersTarget, setAddUsersTarget] = useState<{
    task: PredefinedTask;
    date: Date;
  } | null>(null);
```

S'assurer que `PredefinedTask` est importé (sinon ajouter dans l'import existant `@/services/predefined-tasks.service`).

- [ ] **Step 4.2: Calculer la perm canAssign et passer les props à ActivityGrid**

Dans la zone où `canBalance` ou autres permissions sont calculées, ajouter :

```tsx
  const canAssignPredefinedTask = hasPermission("predefined_tasks:assign");
```

Modifier le rendu `<ActivityGrid ... />` pour ajouter les nouvelles props :

```tsx
        <ActivityGrid
          days={displayDays}
          tasks={predefinedTasks}
          assignments={predefinedAssignments}
          users={users}
          leaves={leaves}
          canAssign={canAssignPredefinedTask}
          onAddUsers={(taskId, dateIso) => {
            const task = predefinedTasks.find((t) => t.id === taskId);
            if (!task) return;
            setAddUsersTarget({ task, date: new Date(dateIso) });
          }}
          isHoliday={(d) => !!getHolidayForDate(d)}
          isWeekend={(d) => [0, 6].includes(d.getDay())}
        />
```

> Note : `leaves` doit être disponible dans le scope de `PlanningView`. Vérifier l'import depuis `usePlanningData` (déjà présent ligne 110 / 203). Si non, déstructurer `leaves` du hook.

- [ ] **Step 4.3: Render la modale conditionnellement à la fin**

Juste avant la fermeture `</div>` finale du JSX retourné, ajouter :

```tsx
      {addUsersTarget && (
        <AddUsersToTaskModal
          task={addUsersTarget.task}
          date={addUsersTarget.date}
          allUsers={users}
          existingAssignments={predefinedAssignments.filter(
            (a) =>
              a.predefinedTaskId === addUsersTarget.task.id &&
              (typeof a.date === "string"
                ? a.date.slice(0, 10)
                : format(a.date as unknown as Date, "yyyy-MM-dd")) ===
                format(addUsersTarget.date, "yyyy-MM-dd"),
          )}
          leaves={leaves}
          onClose={() => setAddUsersTarget(null)}
          onSuccess={() => {
            refetch();
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
```

> Note : si `format` n'est pas déjà importé, ajouter `import { format } from "date-fns";`

- [ ] **Step 4.4: Vérifier compilation TypeScript**

Run: `pnpm --filter web type-check`
Expected: aucune erreur TypeScript.

> Si `pnpm --filter web type-check` n'existe pas, utiliser : `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/components/planning/PlanningView.tsx
git commit -m "feat(planning): câblage AddUsersToTaskModal dans PlanningView"
```

---

## Task 5 : E2E Playwright multi-rôles

**Files:**
- Create: `e2e/tests/activity-grid-add-users.spec.ts`

- [ ] **Step 5.1: Vérifier les helpers disponibles**

Run: `ls e2e/fixtures/`
Expected: voir `permission-matrix.ts`, `auth.ts` (ou similaire). Identifier le helper `asRole()` ou équivalent pour multi-rôle.

Run: `find e2e -name "permission-matrix.ts" -exec head -5 {} \;`
Expected: confirme la structure de la matrice.

- [ ] **Step 5.2: Écrire le E2E**

Créer `e2e/tests/activity-grid-add-users.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

/**
 * E2E — Bouton + Ajouter sur Vue activité (Planning)
 * Vérifie le gating RBAC + workflow d'ajout multi-agents.
 */

const PLANNING_URL = "/fr/planning";

test.describe("Activity Grid — bouton + Ajouter", () => {
  test("@smoke admin peut ouvrir la modale et ajouter des agents", async ({
    page,
  }) => {
    await page.goto(PLANNING_URL);
    // Basculer sur Vue activité
    const activityViewBtn = page.getByRole("button", {
      name: /vue activité/i,
    });
    if (await activityViewBtn.isVisible()) {
      await activityViewBtn.click();
    }

    // Attendre la grille
    await expect(page.locator(".activity-grid")).toBeVisible();

    // Cliquer sur le premier + Ajouter visible
    const addBtn = page
      .getByRole("button", { name: /ajouter/i })
      .filter({ hasNotText: /tâche|imprimer/i })
      .first();
    await addBtn.click();

    // Modale ouverte
    await expect(
      page.getByRole("heading", { name: /ajouter des agents/i }),
    ).toBeVisible();

    // Cocher le premier agent éligible
    const firstCheckbox = page
      .getByRole("checkbox")
      .filter({ has: page.locator(":not([disabled])") })
      .first();
    await firstCheckbox.check();

    // Bouton Ajouter (1) actif
    const submitBtn = page.getByRole("button", { name: /ajouter \(1\)/i });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Toast succès attendu
    await expect(page.getByText(/assignation\(s\) créée\(s\)/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("contributeur ne voit pas le bouton + Ajouter", async ({ page }) => {
    await page.goto(PLANNING_URL);
    const activityViewBtn = page.getByRole("button", {
      name: /vue activité/i,
    });
    // Si l'utilisateur n'a pas planning:activity-view, le bouton n'apparaît pas
    if (!(await activityViewBtn.isVisible({ timeout: 2000 }))) {
      // Skip — pas d'accès à la vue activité
      test.skip(true, "Contributeur n'a pas accès à la Vue activité");
      return;
    }
    await activityViewBtn.click();

    await expect(page.locator(".activity-grid")).toBeVisible();

    // Aucun bouton "+ Ajouter" visible
    const addBtn = page
      .getByRole("button", { name: /ajouter/i })
      .filter({ hasNotText: /tâche|imprimer/i });
    await expect(addBtn).toHaveCount(0);
  });
});
```

- [ ] **Step 5.3: Lancer le E2E sur le projet admin**

Run: `npx playwright test --project=admin activity-grid-add-users`
Expected: le test admin happy path passe (peut prendre 30-60s pour démarrer le navigateur + auth).

> Si la structure des projets Playwright diffère, adapter `--project=admin` au nom réel. Vérifier avec `npx playwright test --list | head -5`.

- [ ] **Step 5.4: Lancer le E2E contributeur**

Run: `npx playwright test --project=contributor activity-grid-add-users`
Expected: le test contributeur passe (skip ou no-bouton confirmé).

- [ ] **Step 5.5: Commit**

```bash
git add e2e/tests/activity-grid-add-users.spec.ts
git commit -m "test(e2e): + Ajouter Vue activité — admin + contributeur"
```

---

## Task 6 : Build, QA manuelle, déploiement VPS

**Files:** N/A (vérification & deploy)

- [ ] **Step 6.1: Build complet**

Run: `pnpm run build`
Expected: build OK pour API et Web (pas d'erreur, pas de warning bloquant).

- [ ] **Step 6.2: Lancer toute la suite Jest planning**

Run: `pnpm --filter web test -- planning --watch=false`
Expected: tous les tests planning PASS (régression check sur ActivityGrid + AddUsersToTaskModal + DayCell).

- [ ] **Step 6.3: QA manuelle locale**

Run en background : `pnpm run dev`

Naviguer dans le browser :
1. Login admin → `/fr/planning` → switch Vue activité
2. Cliquer `+ Ajouter` sur une cellule pleine ET sur une cellule vide
3. Cocher 2-3 agents → vérifier compteur « X agent(s) sélectionné(s) »
4. Valider → toast vert → cellule reflète immédiatement
5. Switch Vue Semaine → vérifier que les agents ajoutés ont bien la tâche sur la ligne du jour
6. Re-cliquer `+ Ajouter` sur la même cellule → vérifier que les agents ajoutés sont pré-cochés + désactivés
7. Tester avec un agent en congé validé → grisé + libellé « en congé · {type} »
8. Login contributeur → vérifier absence du bouton

Si OK, kill le serveur dev.

- [ ] **Step 6.4: Push vers origin/master**

Run: `git push origin master`
Expected: push OK.

- [ ] **Step 6.5: Déploiement VPS**

Run: `ssh vps-orchestra "cd /opt/orchestra && git pull && docker compose --env-file .env.production up -d --no-deps --build api web"`

> Adapter le nom de host SSH (`vps-orchestra`) si différent dans la config locale `~/.ssh/config`. Si inconnu, demander à l'utilisateur.

Expected: pull OK, rebuild conteneurs api + web, services UP.

- [ ] **Step 6.6: Vérification VPS**

Run: `ssh vps-orchestra "docker ps --format '{{.Names}} {{.Status}}' | grep -E 'orchestra-(api|web)'"`
Expected: les 2 conteneurs en `Up`.

Vérifier en browser sur l'URL prod : login → `/fr/planning` → Vue activité → `+ Ajouter` fonctionnel.

- [ ] **Step 6.7: Mise à jour doc utilisateur**

Modifier `docs/user/planning-activites.md` pour ajouter une mention dans le Tutorial 3 (« Consulter et ajuster le planning ») :

Ajouter à la fin de la section « 1. Consulter son planning » :

```markdown
### 1bis. Ajouter rapidement des agents depuis la Vue activité (responsable)

Sur la Vue activité, chaque cellule (tâche × jour) propose un bouton **+ Ajouter** :

- **Cellule vide** : `+ Ajouter` à la place du tiret.
- **Cellule pleine** : `+ Ajouter` discret en bas de la liste d'agents.

Au clic, une modale s'ouvre avec la liste de tous les agents :
- Les agents **déjà assignés** apparaissent cochés et grisés.
- Les agents **en congé validé** sur ce jour apparaissent grisés avec mention du type de congé.
- Les autres agents sont sélectionnables.

Cochez un ou plusieurs agents puis cliquez **Ajouter (N)**. Les assignations sont créées immédiatement et apparaissent à la fois dans la Vue activité et dans les vues Semaine/Mois des agents concernés.

Cette action requiert le droit *« assignation tâches prédéfinies »* (rôles ADMIN, RESPONSABLE, MANAGER).
```

- [ ] **Step 6.8: Commit doc + push**

```bash
git add docs/user/planning-activites.md
git commit -m "docs(user): ajout section + Ajouter Vue activité (V1.2)"
git push origin master
```

---

## Self-Review Checklist

- [x] **Couverture spec** : section 3 UX → Tasks 2 + 3 + 4. Section 4 architecture → Tasks 2 + 3 + 4. Section 6 tests → Tasks 2 + 3 + 5. Section 7 i18n → Task 1. Sections 8/10 edge cases + critères → couverts par tests Jest + E2E + QA manuelle Task 6.
- [x] **Pas de placeholder** : tous les blocs code sont complets, prêts à coller.
- [x] **Cohérence types** : `EligibilityStatus`, `EligibilityInfo`, `toPeriod`, `AddUsersToTaskModalProps` cohérents entre Task 2 et Task 4. `onAddUsers(taskId, dateIso)` signature identique en Task 3 et Task 4.
- [x] **TDD respecté** : test puis impl à chaque task feature.
- [x] **Commits frequents** : 1 commit par task (4 commits front + 1 commit E2E + 1 commit doc + push final).

---

## Notes pour l'exécutant

- Ne pas créer de feature branch — travailler directement sur `master` (mémoire utilisateur).
- Toujours `pnpm`, jamais npm ni yarn.
- Pour le déploiement VPS, le host SSH est probablement `vps-orchestra` mais à confirmer dans `~/.ssh/config`.
- Si une assertion E2E ne matche pas un sélecteur exact, adapter aux sélecteurs réels (les tests E2E sont parfois fragiles aux libellés exacts — ajuster mais ne pas affaiblir l'intention).
- Aucune migration Prisma. Aucun changement RBAC. Aucun changement backend. **Frontend pur.**
