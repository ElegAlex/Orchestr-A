/**
 * ActivityGrid.test.tsx — W4.3
 * Tests unitaires pour le composant ActivityGrid (variante B aérée).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { ActivityGrid } from "../ActivityGrid";
import type {
  PredefinedTask,
  PredefinedTaskAssignment,
} from "@/services/predefined-tasks.service";
import type { UserSummary } from "@/types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// CSS import mock (next/jest doesn't handle .css by default w/o identity-obj-proxy)
jest.mock("../ActivityGrid.print.css", () => ({}), { virtual: true });

jest.mock("next-intl", () => ({
  useTranslations: () =>
    (key: string, params?: Record<string, string | number>) => {
      const dict: Record<string, string> = {
        "activityGrid.caption": "Grille d'activité — jours en lignes, tâches en colonnes",
        "activityGrid.dateCol": "Jour",
        "activityGrid.emptyCell": "—",
        "activityGrid.moreUsers": `+${params?.count ?? ""}`,
        "activityGrid.print": "Imprimer",
        "activityGrid.emptyState": "Aucune tâche prédéfinie active",
        "status.DONE": "Fait",
        "status.IN_PROGRESS": "En cours",
        "status.NOT_DONE": "À faire",
        "status.NOT_APPLICABLE": "N/A",
        "status.LATE": "Retard",
      };
      if (key in dict) return dict[key];
      // Fallback: interpolate basic {count}
      if (params) {
        let result = key;
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, String(v));
        }
        return result;
      }
      return key;
    },
}));

jest.mock("@/components/UserAvatar", () => ({
  UserAvatar: ({ user }: { user: { firstName: string; lastName: string } }) => (
    <div
      data-testid="user-avatar"
      aria-label={`${user.firstName} ${user.lastName}`}
    >
      {user.firstName[0]}{user.lastName[0]}
    </div>
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CURRENT_DATE = new Date("2026-05-11T10:00:00Z");

function makeTask(overrides: Partial<PredefinedTask> = {}): PredefinedTask {
  return {
    id: "t1",
    name: "Permanence M.",
    description: null,
    color: "#3b82f6",
    icon: "📋",
    defaultDuration: "FULL_DAY",
    startTime: null,
    endTime: null,
    isExternalIntervention: false,
    isActive: true,
    weight: 3,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeUser(
  overrides: Partial<UserSummary> = {},
): UserSummary {
  return {
    id: "u1",
    firstName: "Marie",
    lastName: "Dupont",
    email: "marie@test.fr",
    role: "CONTRIBUTEUR",
    avatarUrl: null,
    avatarPreset: null,
    ...overrides,
  } as unknown as UserSummary;
}

function makeAssignment(
  overrides: Partial<PredefinedTaskAssignment> = {},
): PredefinedTaskAssignment {
  return {
    id: "a1",
    predefinedTaskId: "t1",
    userId: "u1",
    date: "2026-05-11",
    period: "FULL_DAY",
    note: null,
    createdById: "admin",
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
    completionStatus: "DONE",
    completedAt: null,
    completedById: null,
    notApplicableReason: null,
    canUpdateStatus: true,
    ...overrides,
  };
}

const defaultProps = {
  days: [
    new Date("2026-05-11"),
    new Date("2026-05-12"),
    new Date("2026-05-13"),
  ],
  tasks: [makeTask({ id: "t1", name: "Permanence M." })],
  assignments: [],
  users: [makeUser({ id: "u1" })],
  lateThresholdDays: 2,
  currentUserId: "u1",
  onAssignmentStatusChanged: jest.fn(),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ActivityGrid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fix current date for late calculation
    jest.useFakeTimers({ now: CURRENT_DATE });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Test 1 — Dimensions : N jours × M tâches → N lignes body + M colonnes de tâches + 1 col date.
   */
  it("rend N lignes × M colonnes selon les props (days=3, tasks=2 → 3 body rows, 3 cols)", () => {
    const days = [
      new Date("2026-05-11"),
      new Date("2026-05-12"),
      new Date("2026-05-13"),
    ];
    const tasks = [
      makeTask({ id: "t1", name: "Permanence M." }),
      makeTask({ id: "t2", name: "Accueil tél." }),
    ];

    const { container } = render(
      <ActivityGrid {...defaultProps} days={days} tasks={tasks} />,
    );

    const tbody = container.querySelector("tbody");
    const rows = tbody?.querySelectorAll("tr");
    expect(rows?.length).toBe(3); // 3 jours

    const thead = container.querySelector("thead");
    const headerCols = thead?.querySelectorAll("th");
    // Col date + 2 task cols = 3
    expect(headerCols?.length).toBe(3);
  });

  /**
   * Test 2 — Cellule vide : aucun assignment → bg-zinc-50, pas d'avatar.
   */
  it("affiche une cellule vide quand aucun assignment (pas d'avatar)", () => {
    const { container } = render(
      <ActivityGrid {...defaultProps} assignments={[]} />,
    );

    // Aucun avatar
    const avatars = screen.queryAllByTestId("user-avatar");
    expect(avatars.length).toBe(0);

    // Présence d'une cellule vide avec classe bg-zinc-50
    const emptyCells = container.querySelectorAll("td.bg-zinc-50");
    expect(emptyCells.length).toBeGreaterThan(0);
  });

  /**
   * Test 3 — Cellule avec 2 assignments affiche 2 avatars + 1 badge statut.
   */
  it("affiche 2 avatars overlapped + 1 badge statut pour 2 assignments dans une cellule", () => {
    const days = [new Date("2026-05-11")];
    const tasks = [makeTask({ id: "t1" })];
    const users = [
      makeUser({ id: "u1", firstName: "Marie", lastName: "Dupont" }),
      makeUser({ id: "u2", firstName: "Paul", lastName: "Lemaire" }),
    ];
    const assignments = [
      makeAssignment({ id: "a1", userId: "u1", predefinedTaskId: "t1", date: "2026-05-11", completionStatus: "DONE" }),
      makeAssignment({ id: "a2", userId: "u2", predefinedTaskId: "t1", date: "2026-05-11", completionStatus: "DONE" }),
    ];

    render(
      <ActivityGrid
        {...defaultProps}
        days={days}
        tasks={tasks}
        assignments={assignments}
        users={users}
      />,
    );

    const avatars = screen.getAllByTestId("user-avatar");
    expect(avatars.length).toBe(2);

    // Un badge statut pill doit être présent
    const statusBadge = screen.getByRole("status");
    expect(statusBadge).toBeInTheDocument();
  });

  /**
   * Test 4 — Bouton "Imprimer" présent + déclenche window.print au click.
   */
  it("le bouton Imprimer est présent et appelle window.print au click", () => {
    const printMock = jest.fn();
    const originalPrint = window.print;
    window.print = printMock;

    render(<ActivityGrid {...defaultProps} />);

    const printBtn = screen.getByRole("button", { name: /imprimer/i });
    expect(printBtn).toBeInTheDocument();

    fireEvent.click(printBtn);
    expect(printMock).toHaveBeenCalledTimes(1);

    window.print = originalPrint;
  });

  /**
   * Test 5 — Accessibilité : <table> avec <caption> sr-only, <th scope="col">,
   * <th scope="row">.
   */
  it("respecte la sémantique table : caption sr-only, th scope=col pour tâches, th scope=row pour dates", () => {
    const { container } = render(<ActivityGrid {...defaultProps} />);

    // Caption présent avec classe sr-only
    const caption = container.querySelector("caption");
    expect(caption).toBeInTheDocument();
    expect(caption?.className).toMatch(/sr-only/);

    // th scope="col" pour chaque tâche
    const colHeaders = container.querySelectorAll('thead th[scope="col"]');
    expect(colHeaders.length).toBeGreaterThan(0);

    // th scope="row" pour chaque jour
    const rowHeaders = container.querySelectorAll('tbody th[scope="row"]');
    expect(rowHeaders.length).toBe(defaultProps.days.length);
  });

  /**
   * Test 6 — Week-end : classe bg-zinc-100 appliquée sur la ligne.
   */
  it("applique bg-zinc-100 sur les lignes du week-end quand isWeekend retourne true", () => {
    const saturdayDay = new Date("2026-05-09"); // Samedi
    const { container } = render(
      <ActivityGrid
        {...defaultProps}
        days={[saturdayDay]}
        isWeekend={(d) => [0, 6].includes(d.getDay())}
      />,
    );

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].className).toMatch(/bg-zinc-100/);
  });

  /**
   * Test 7 — Ferié : classe bg-zinc-100 appliquée.
   */
  it("applique bg-zinc-100 sur les lignes fériées quand isHoliday retourne true", () => {
    const holidayDay = new Date("2026-05-08"); // Victoire 45
    const { container } = render(
      <ActivityGrid
        {...defaultProps}
        days={[holidayDay]}
        isHoliday={() => true}
      />,
    );

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(rows[0].className).toMatch(/bg-zinc-100/);
  });

  /**
   * Test 8 — emptyState : affiche un message si aucune tâche.
   */
  it("affiche le message emptyState quand la liste de tâches est vide", () => {
    render(<ActivityGrid {...defaultProps} tasks={[]} />);
    expect(
      screen.getByText(/aucune tâche prédéfinie active/i),
    ).toBeInTheDocument();
  });

  /**
   * Test 9 — +N overflow : si plus de 3 assignés sur une cellule, affiche "+N".
   */
  it("affiche +N quand il y a plus de 3 assignés dans la même cellule", () => {
    const days = [new Date("2026-05-11")];
    const tasks = [makeTask({ id: "t1" })];
    const users = [
      makeUser({ id: "u1", firstName: "Marie", lastName: "D." }),
      makeUser({ id: "u2", firstName: "Paul", lastName: "L." }),
      makeUser({ id: "u3", firstName: "Sophie", lastName: "M." }),
      makeUser({ id: "u4", firstName: "Karim", lastName: "B." }),
    ];
    const assignments = users.map((u, i) =>
      makeAssignment({
        id: `a${i}`,
        userId: u.id,
        predefinedTaskId: "t1",
        date: "2026-05-11",
        completionStatus: "DONE",
      }),
    );

    render(
      <ActivityGrid
        {...defaultProps}
        days={days}
        tasks={tasks}
        assignments={assignments}
        users={users}
      />,
    );

    // 3 avatars max + "+1" text
    const avatars = screen.getAllByTestId("user-avatar");
    expect(avatars.length).toBe(3);
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
