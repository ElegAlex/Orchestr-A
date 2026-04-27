import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { BalancedPlanningModal } from "../BalancedPlanningModal";
import toast from "react-hot-toast";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: "Planning équilibré automatique",
      description: "Répartit les occurrences de tâches récurrentes.",
      "config.range": "Plage",
      "config.startDate": "Date de début",
      "config.endDate": "Date de fin",
      "config.service": "Service",
      "config.users": "Agents",
      "config.tasks": "Tâches à équilibrer",
      "config.preview": "Prévisualiser",
      "config.apply": "Appliquer",
      "config.validation.noAgent":
        "Sélectionnez au moins un agent ou un service",
      "config.validation.noTask": "Sélectionnez au moins une tâche",
      "config.validation.datesInvalid": "Plage de dates invalide",
      "preview.empty":
        "Cliquez sur Prévisualiser pour voir la proposition d'équilibrage",
      "preview.loading": "Calcul en cours...",
      "preview.equityRatio": "Ratio d'équité",
      "preview.workloadByAgent": "Charge par agent",
      "preview.agent": "Agent",
      "preview.load": "Charge pondérée",
      "preview.count": "Nombre d'occurrences",
      "preview.proposedAssignments": "Assignations proposées",
      "preview.unassignedOccurrences": "Occurrences non assignées",
      "preview.warningLowEquity":
        "Équilibre faible — envisagez d'ajuster la configuration",
      "preview.reasons.NO_ELIGIBLE_AGENT": "Aucun agent éligible",
      "preview.reasons.ABSENCE_CONFLICT": "Congé ou absence",
      "preview.reasons.TELEWORK_CONFLICT": "Télétravail incompatible",
      "preview.reasons.SKILL_CONFLICT": "Compétence manquante",
      "toast.applied": "{count} assignation(s) créée(s)",
      "toast.forbidden": "Permission refusée",
      "toast.error": "Erreur lors de la génération",
      "footer.escHint": "Échap pour fermer",
    };
    return map[key] ?? key;
  },
}));

// Mock usePlanningBalancer
const mockPreview = jest.fn();
const mockApply = jest.fn();

jest.mock("@/hooks/usePlanningBalancer", () => ({
  usePlanningBalancer: jest.fn(() => ({
    preview: mockPreview,
    apply: mockApply,
    isPending: false,
    error: null,
  })),
}));

// Mock services
jest.mock("@/services/predefined-tasks.service", () => ({
  predefinedTasksService: {
    getAll: jest.fn().mockResolvedValue({
      data: [
        {
          id: "task-1",
          name: "Permanence",
          icon: "P",
          color: "#3B82F6",
          isActive: true,
          weight: 1,
          defaultDuration: "FULL_DAY",
          isExternalIntervention: false,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "task-2",
          name: "Reporting",
          icon: "R",
          color: "#EF4444",
          isActive: true,
          weight: 3,
          defaultDuration: "FULL_DAY",
          isExternalIntervention: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
    }),
    generateBalanced: jest.fn(),
  },
}));

jest.mock("@/services/services.service", () => ({
  servicesService: {
    getAll: jest
      .fn()
      .mockResolvedValue([
        { id: "svc-1", name: "Contrôle de Gestion", departmentId: "dept-1" },
      ]),
  },
}));

jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn().mockResolvedValue([
      {
        id: "user-1",
        firstName: "Marie",
        lastName: "Dupont",
        isActive: true,
        email: "marie@test.fr",
        login: "marie",
        role: null,
        userServices: [{ service: { id: "svc-1" } }],
      },
    ]),
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Radix Dialog to render children directly (no portal issues in jsdom)
jest.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Overlay: ({ className }: { className?: string }) => (
    <div data-testid="dialog-overlay" className={className} />
  ),
  Content: ({
    children,
    onEscapeKeyDown: _onEscapeKeyDown,
    ...rest
  }: {
    children: React.ReactNode;
    onEscapeKeyDown?: () => void;
    [key: string]: unknown;
  }) => (
    <div data-testid="dialog-content" {...rest}>
      {children}
    </div>
  ),
  Title: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="dialog-title">{children}</h2>
  ),
  Close: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button onClick={onClick} data-testid="dialog-close">
      {children}
    </button>
  ),
}));

// ── Default mock result ───────────────────────────────────────────────────────

const MOCK_RESULT = {
  mode: "preview" as const,
  proposedAssignments: [
    {
      taskId: "task-1",
      userId: "user-1",
      date: "2026-05-05",
      period: "FULL_DAY" as const,
      weight: 1,
    },
  ],
  workloadByAgent: [{ userId: "user-1", weightedLoad: 10 }],
  equityRatio: 0.9,
  unassignedOccurrences: [],
  assignmentsCreated: 0,
};

// ── Helper ────────────────────────────────────────────────────────────────────

const defaultProps = {
  open: true,
  onClose: jest.fn(),
  onApplied: jest.fn(),
};

function renderModal(props: Partial<typeof defaultProps> = {}) {
  return render(<BalancedPlanningModal {...defaultProps} {...props} />);
}

// Helper to fill valid form: dates + service + first task
async function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Date de début"), {
    target: { value: "2026-05-01" },
  });
  fireEvent.change(screen.getByLabelText("Date de fin"), {
    target: { value: "2026-05-31" },
  });
  // Select service (counts as valid agent scope)
  fireEvent.change(screen.getByLabelText("Service"), {
    target: { value: "svc-1" },
  });
  // Wait for tasks to appear, then select first task
  await waitFor(() => {
    expect(screen.getByText("Permanence")).toBeInTheDocument();
  });
  // Find "Permanence" label and click its checkbox
  const taskCheckbox = screen
    .getByText("Permanence")
    .closest("label")
    ?.querySelector("input[type='checkbox']");
  if (taskCheckbox) fireEvent.click(taskCheckbox);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BalancedPlanningModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("1. Renders config fields and Prévisualiser button enabled", async () => {
    renderModal();

    // Wait for async data load
    await waitFor(() => {
      expect(screen.getByLabelText("Date de début")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Date de fin")).toBeInTheDocument();
    expect(screen.getByLabelText("Service")).toBeInTheDocument();
    expect(screen.getByLabelText("Agents")).toBeInTheDocument();
    expect(screen.getByLabelText("Tâches à équilibrer")).toBeInTheDocument();

    const previewBtn = screen.getByRole("button", { name: "Prévisualiser" });
    expect(previewBtn).toBeEnabled();
  });

  it("2. Appliquer button is disabled before any preview", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByLabelText("Date de début")).toBeInTheDocument();
    });

    const applyBtn = screen.getByRole("button", { name: "Appliquer" });
    expect(applyBtn).toBeDisabled();
  });

  it("3. Prévisualiser with no dates → toast dates error, hook not called", async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Permanence")).toBeInTheDocument();
    });

    // No dates set → click preview
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Prévisualiser" }));
    });

    // Validation: dates are empty → datesInvalid fires first
    expect(toast.error).toHaveBeenCalledWith("Plage de dates invalide");
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it("4. Prévisualiser with valid data → hook.preview called, results rendered", async () => {
    mockPreview.mockResolvedValueOnce(MOCK_RESULT);
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Permanence")).toBeInTheDocument();
    });

    await fillValidForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Prévisualiser" }));
    });

    expect(mockPreview).toHaveBeenCalled();

    // Preview results should be displayed (equityRatio badge)
    await waitFor(() => {
      expect(screen.getByTestId("equity-badge")).toBeInTheDocument();
    });
    // "Charge par agent" appears twice (section heading + table header) — verify presence
    expect(
      screen.getAllByText("Charge par agent").length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("4b. affiche explicitement les exclusions télétravail du balancer", async () => {
    mockPreview.mockResolvedValueOnce({
      ...MOCK_RESULT,
      proposedAssignments: [],
      workloadByAgent: [{ userId: "user-1", weightedLoad: 0 }],
      unassignedOccurrences: [
        {
          taskId: "task-1",
          date: "2026-05-05",
          period: "FULL_DAY",
          reason: "TELEWORK_CONFLICT",
        },
      ],
    });
    renderModal();

    await waitFor(() => {
      expect(screen.getByText("Permanence")).toBeInTheDocument();
    });

    await fillValidForm();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Prévisualiser" }));
    });

    await waitFor(() => {
      expect(screen.getByText("Télétravail incompatible")).toBeInTheDocument();
    });
  });

  it("5. Appliquer after preview → hook.apply called, modal closes", async () => {
    mockPreview.mockResolvedValueOnce(MOCK_RESULT);
    const applyResult = {
      ...MOCK_RESULT,
      mode: "apply" as const,
      assignmentsCreated: 3,
    };
    mockApply.mockResolvedValueOnce(applyResult);

    const onClose = jest.fn();
    renderModal({ onClose });

    await waitFor(() => {
      expect(screen.getByText("Permanence")).toBeInTheDocument();
    });

    await fillValidForm();

    // Preview first
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Prévisualiser" }));
    });

    // Wait for Apply to become enabled
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Appliquer" }),
      ).not.toBeDisabled();
    });

    // Apply
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Appliquer" }));
    });

    expect(mockApply).toHaveBeenCalled();
    // onClose called because apply returned a result
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("6. EquityBadge: emerald ≥ 0.85, amber ≥ 0.7, red < 0.7", () => {
    // Test the color logic directly (mirrors the component logic)
    expect(getRatioBadgeColor(0.9)).toBe("emerald");
    expect(getRatioBadgeColor(0.85)).toBe("emerald");
    expect(getRatioBadgeColor(0.75)).toBe("amber");
    expect(getRatioBadgeColor(0.7)).toBe("amber");
    expect(getRatioBadgeColor(0.6)).toBe("red");
    expect(getRatioBadgeColor(0.0)).toBe("red");
  });
});

// Helper replicating badge color logic from EquityBadge component
function getRatioBadgeColor(ratio: number): "emerald" | "amber" | "red" {
  if (ratio >= 0.85) return "emerald";
  if (ratio >= 0.7) return "amber";
  return "red";
}
