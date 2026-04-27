/**
 * AddUsersToTaskModal.test.tsx — Vue activité, bouton + inversé
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AddUsersToTaskModal } from "../AddUsersToTaskModal";
import { predefinedTasksService } from "@/services/predefined-tasks.service";
import type {
  PredefinedTask,
  PredefinedTaskAssignment,
} from "@/services/predefined-tasks.service";
import type { UserSummary, Leave, TeleworkSchedule } from "@/types";

jest.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, params?: Record<string, string | number>) => {
      const dict: Record<string, string> = {
        "activityGrid.addUsersModal.title": "Ajouter des agents",
        "activityGrid.addUsersModal.alreadyAssigned": "déjà assigné",
        "activityGrid.addUsersModal.onTelework": "en télétravail",
        "activityGrid.addUsersModal.noEligibleUsers":
          "Tous les agents sont déjà assignés, en congé ou en télétravail ce jour.",
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
    <span data-testid="avatar">
      {user.firstName?.[0]}
      {user.lastName?.[0]}
    </span>
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

const buildUser = (
  id: string,
  firstName: string,
  lastName: string,
): UserSummary => ({ id, firstName, lastName, isActive: true }) as UserSummary;

const buildTask = (overrides: Partial<PredefinedTask> = {}): PredefinedTask =>
  ({
    id: "t1",
    name: "Permanence accueil",
    description: null,
    color: "#3B82F6",
    icon: "📋",
    defaultDuration: "FULL_DAY",
    isExternalIntervention: false,
    isTeleworkAllowed: true,
    isActive: true,
    weight: 2,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    ...overrides,
  }) as PredefinedTask;

const buildAssignment = (
  id: string,
  userId: string,
): PredefinedTaskAssignment =>
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

const buildTelework = (userId: string, date: string): TeleworkSchedule =>
  ({
    id: `telework-${userId}`,
    userId,
    date,
    isTelework: true,
    isException: false,
    createdAt: "2026-01-01",
  }) as TeleworkSchedule;

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

  it("désactive les agents en télétravail pour une tâche présentielle", () => {
    const users = [buildUser("u1", "Marie", "Dupont")];
    render(
      <AddUsersToTaskModal
        task={buildTask({ isTeleworkAllowed: false })}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[]}
        teleworkSchedules={[buildTelework("u1", "2026-05-12")]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(screen.getByText("en télétravail")).toBeInTheDocument();
  });

  it("garde les agents en télétravail éligibles pour une tâche compatible", () => {
    const users = [buildUser("u1", "Marie", "Dupont")];
    render(
      <AddUsersToTaskModal
        task={buildTask({ isTeleworkAllowed: true })}
        date={new Date("2026-05-12")}
        allUsers={users}
        existingAssignments={[]}
        leaves={[]}
        teleworkSchedules={[buildTelework("u1", "2026-05-12")]}
        onClose={jest.fn()}
        onSuccess={jest.fn()}
      />,
    );
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(false);
  });

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
        "Tous les agents sont déjà assignés, en congé ou en télétravail ce jour.",
      ),
    ).toBeInTheDocument();
  });
});
