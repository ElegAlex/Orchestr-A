/**
 * ActivityGrid.test.tsx — W4.3 + W6.2 (cellule liste nom+prénom)
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityGrid } from "../ActivityGrid";
import type {
  PredefinedTask,
  PredefinedTaskAssignment,
} from "@/services/predefined-tasks.service";
import type { UserSummary } from "@/types";

jest.mock("next-intl", () => ({
  useTranslations: () =>
    (key: string, params?: Record<string, string | number>) => {
      const dict: Record<string, string> = {
        "activityGrid.caption": "Grille d'activité",
        "activityGrid.dateCol": "Jour",
        "activityGrid.emptyCell": "—",
        "activityGrid.print": "Imprimer",
        "activityGrid.emptyState": "Aucune tâche prédéfinie active",
        "activityGrid.addUsers": "Ajouter",
      };
      if (key === "activityGrid.moreUsers" && params) {
        return `+${params.count} autres`;
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

const day = (iso: string) => new Date(iso);

const buildUser = (
  id: string,
  firstName: string,
  lastName: string,
): UserSummary =>
  ({ id, firstName, lastName, isActive: true }) as UserSummary;

const buildTask = (id: string, name: string): PredefinedTask =>
  ({
    id,
    name,
    description: null,
    color: "#3B82F6",
    icon: "📋",
    defaultDuration: "FULL_DAY",
    isExternalIntervention: false,
    isActive: true,
    weight: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }) as PredefinedTask;

const buildAssignment = (
  id: string,
  taskId: string,
  userId: string,
  date: string,
): PredefinedTaskAssignment =>
  ({
    id,
    predefinedTaskId: taskId,
    userId,
    date,
    period: "FULL_DAY",
    createdById: "u-creator",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }) as PredefinedTaskAssignment;

describe("ActivityGrid", () => {
  it("rend N lignes × M colonnes (3 jours × 2 tâches)", () => {
    render(
      <ActivityGrid
        days={[day("2026-04-20"), day("2026-04-21"), day("2026-04-22")]}
        tasks={[buildTask("t1", "Permanence"), buildTask("t2", "Reporting")]}
        assignments={[]}
        users={[]}
      />,
    );
    // 3 col headers (Jour + 2 tasks) + 3 row headers (1 par jour)
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getAllByRole("rowheader")).toHaveLength(3);
  });

  it("cellule vide rend le caractère 'emptyCell'", () => {
    render(
      <ActivityGrid
        days={[day("2026-04-20")]}
        tasks={[buildTask("t1", "T1")]}
        assignments={[]}
        users={[]}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("rend une liste verticale Prénom NOM par agent assigné", () => {
    const u1 = buildUser("u1", "Marie", "Dupont");
    const u2 = buildUser("u2", "Paul", "Lemoine");
    render(
      <ActivityGrid
        days={[day("2026-04-20")]}
        tasks={[buildTask("t1", "Permanence")]}
        assignments={[
          buildAssignment("a1", "t1", "u1", "2026-04-20"),
          buildAssignment("a2", "t1", "u2", "2026-04-20"),
        ]}
        users={[u1, u2]}
      />,
    );
    // Prénoms en casse normale, noms en CAPITALES
    expect(screen.getByText("Marie")).toBeInTheDocument();
    expect(screen.getByText("DUPONT")).toBeInTheDocument();
    expect(screen.getByText("Paul")).toBeInTheDocument();
    expect(screen.getByText("LEMOINE")).toBeInTheDocument();
    expect(screen.getAllByTestId("avatar")).toHaveLength(2);
  });

  it("affiche '+N autres' si plus de 3 agents dans la cellule", () => {
    const users = Array.from({ length: 5 }, (_, i) =>
      buildUser(`u${i}`, `User${i}`, `Test${i}`),
    );
    render(
      <ActivityGrid
        days={[day("2026-04-20")]}
        tasks={[buildTask("t1", "Permanence")]}
        assignments={users.map((u, i) =>
          buildAssignment(`a${i}`, "t1", u.id, "2026-04-20"),
        )}
        users={users}
      />,
    );
    expect(screen.getAllByTestId("avatar")).toHaveLength(3);
    expect(screen.getByText("+2 autres")).toBeInTheDocument();
  });

  it("bouton Imprimer présent et appelle window.print", () => {
    const printSpy = jest.spyOn(window, "print").mockImplementation(() => {});
    render(
      <ActivityGrid
        days={[day("2026-04-20")]}
        tasks={[buildTask("t1", "T1")]}
        assignments={[]}
        users={[]}
      />,
    );
    const btn = screen.getByRole("button", { name: /imprimer/i });
    fireEvent.click(btn);
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("emptyState si aucune tâche", () => {
    render(
      <ActivityGrid
        days={[day("2026-04-20")]}
        tasks={[]}
        assignments={[]}
        users={[]}
      />,
    );
    expect(
      screen.getByText("Aucune tâche prédéfinie active"),
    ).toBeInTheDocument();
  });

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
});
