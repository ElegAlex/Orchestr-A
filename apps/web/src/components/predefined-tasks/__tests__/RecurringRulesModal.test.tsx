import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecurringRulesModal } from "../RecurringRulesModal";
import { PredefinedTask, PredefinedTaskRecurringRule } from "@/services/predefined-tasks.service";

// Mock next-intl (same pattern as WeightInput.test.tsx)
jest.mock("next-intl", () => ({
  useTranslations: () =>
    (key: string) => {
      const translations: Record<string, string> = {
        // weight (existing, keep)
        "weight.label": "Poids / charge",
        "weight.hint": "Pondération utilisée par l'équilibrage automatique",
        // recurrence type
        "recurrence.type.label": "Type de récurrence",
        "recurrence.type.WEEKLY": "Hebdomadaire",
        "recurrence.type.MONTHLY_DAY": "Mensuelle à date fixe",
        "recurrence.type.MONTHLY_ORDINAL": "Mensuelle ordinale",
        // monthlyDay
        "recurrence.monthlyDay.label": "Jour du mois",
        "recurrence.monthlyDay.hint": "Si le jour n'existe pas, l'assignation est clampée au dernier jour du mois",
        // monthlyOrdinal
        "recurrence.monthlyOrdinal.label": "Occurrence dans le mois",
        "recurrence.monthlyOrdinal.options.1": "1er",
        "recurrence.monthlyOrdinal.options.2": "2e",
        "recurrence.monthlyOrdinal.options.3": "3e",
        "recurrence.monthlyOrdinal.options.4": "4e",
        "recurrence.monthlyOrdinal.options.5": "Dernier",
        // dayOfWeek
        "recurrence.dayOfWeek.label": "Jour de la semaine",
        "recurrence.dayOfWeek.options.MONDAY": "Lundi",
        "recurrence.dayOfWeek.options.TUESDAY": "Mardi",
        "recurrence.dayOfWeek.options.WEDNESDAY": "Mercredi",
        "recurrence.dayOfWeek.options.THURSDAY": "Jeudi",
        "recurrence.dayOfWeek.options.FRIDAY": "Vendredi",
        "recurrence.dayOfWeek.options.SATURDAY": "Samedi",
        "recurrence.dayOfWeek.options.SUNDAY": "Dimanche",
        // weekInterval
        "recurrence.weekInterval.label": "Fréquence",
        "recurrence.weekInterval.hint": "1 = chaque semaine, 2 = toutes les 2 semaines, etc.",
      };
      return translations[key] ?? key;
    },
}));

// Mock usePermissions
jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

// Mock usersService
jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn().mockResolvedValue([
      { id: "u1", firstName: "Alice", lastName: "Dupont", isActive: true },
      { id: "u2", firstName: "Bob", lastName: "Martin", isActive: true },
    ]),
  },
}));

// Mock predefinedTasksService
const mockBulkCreate = jest.fn().mockResolvedValue({ created: 1, rules: [] });
const mockCreateRecurringRule = jest.fn().mockResolvedValue({ id: "rule-new" });
const mockUpdateRecurringRule = jest.fn().mockResolvedValue({});
const mockDeleteRecurringRule = jest.fn().mockResolvedValue({});

jest.mock("@/services/predefined-tasks.service", () => ({
  ...jest.requireActual("@/services/predefined-tasks.service"),
  predefinedTasksService: {
    bulkCreateRecurringRules: (...args: unknown[]) => mockBulkCreate(...args),
    createRecurringRule: (...args: unknown[]) => mockCreateRecurringRule(...args),
    updateRecurringRule: (...args: unknown[]) => mockUpdateRecurringRule(...args),
    deleteRecurringRule: (...args: unknown[]) => mockDeleteRecurringRule(...args),
  },
}));

// Mock react-hot-toast
jest.mock("react-hot-toast", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn: any = jest.fn();
  fn.success = jest.fn();
  fn.error = jest.fn();
  return { __esModule: true, default: fn };
});

// ── Test fixtures ────────────────────────────────────────────────────────────

const baseTask: PredefinedTask = {
  id: "task-1",
  name: "Astreinte",
  color: "#3b82f6",
  icon: "🔧",
  defaultDuration: "FULL_DAY",
  isExternalIntervention: false,
  isActive: true,
  weight: 1,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const weeklyRule: PredefinedTaskRecurringRule = {
  id: "rule-1",
  predefinedTaskId: "task-1",
  userId: "u1",
  recurrenceType: "WEEKLY",
  dayOfWeek: "MONDAY",
  period: "FULL_DAY",
  weekInterval: 1,
  startDate: "2024-01-01",
  isActive: true,
  createdById: "admin",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  user: { id: "u1", firstName: "Alice", lastName: "Dupont", email: "a@a.fr" },
};

const monthlyDayRule: PredefinedTaskRecurringRule = {
  id: "rule-2",
  predefinedTaskId: "task-1",
  userId: "u1",
  recurrenceType: "MONTHLY_DAY",
  dayOfWeek: "MONDAY", // irrelevant for MONTHLY_DAY but present as nullable
  monthlyDayOfMonth: 15,
  period: "FULL_DAY",
  weekInterval: 1,
  startDate: "2024-01-01",
  isActive: true,
  createdById: "admin",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  user: { id: "u1", firstName: "Alice", lastName: "Dupont", email: "a@a.fr" },
};

const onClose = jest.fn();
const onRulesChanged = jest.fn().mockResolvedValue(undefined);

function renderModal(rules: PredefinedTaskRecurringRule[] = []) {
  return render(
    <RecurringRulesModal
      task={baseTask}
      rules={rules}
      onClose={onClose}
      onRulesChanged={onRulesChanged}
    />,
  );
}

// Helper: open the create form
async function openCreateForm() {
  const addBtn = screen.getByRole("button", { name: /ajouter/i });
  fireEvent.click(addBtn);
  // Wait for users to load
  await waitFor(() => screen.getByText("Alice Dupont"));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RecurringRulesModal — recurrence type extension", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onRulesChanged.mockResolvedValue(undefined);
  });

  // 1. Default mode WEEKLY
  it("1. par défaut, le mode WEEKLY est sélectionné et dayOfWeek picker est visible", async () => {
    renderModal();
    await openCreateForm();

    // Radio group label
    expect(screen.getByText("Type de récurrence")).toBeInTheDocument();

    // WEEKLY radio is checked
    const weeklyRadio = screen.getByRole("radio", { name: /hebdomadaire/i });
    expect(weeklyRadio).toBeChecked();

    // dayOfWeek pills are visible (WEEKLY mode shows day pills)
    expect(screen.getByText("Lun")).toBeInTheDocument();
  });

  // 2. Switch to MONTHLY_DAY
  it("2. bascule sur MONTHLY_DAY : monthlyDayOfMonth visible, dayOfWeek masqué", async () => {
    renderModal();
    await openCreateForm();

    const monthlyDayRadio = screen.getByRole("radio", { name: /mensuelle à date fixe/i });
    fireEvent.click(monthlyDayRadio);

    // monthlyDayOfMonth input appears
    expect(screen.getByLabelText(/jour du mois/i)).toBeInTheDocument();
    const dayInput = screen.getByLabelText(/jour du mois/i) as HTMLInputElement;
    expect(dayInput.type).toBe("number");

    // Day-of-week pills are gone
    expect(screen.queryByText("Lun")).not.toBeInTheDocument();
    // weekInterval is gone
    expect(screen.queryByText("Fréquence")).not.toBeInTheDocument();
  });

  // 3. Switch to MONTHLY_ORDINAL
  it("3. bascule sur MONTHLY_ORDINAL : monthlyOrdinal + dayOfWeek visibles, monthlyDayOfMonth masqué", async () => {
    renderModal();
    await openCreateForm();

    const ordinalRadio = screen.getByRole("radio", { name: /mensuelle ordinale/i });
    fireEvent.click(ordinalRadio);

    // monthlyOrdinal select
    expect(screen.getByLabelText(/occurrence dans le mois/i)).toBeInTheDocument();
    const ordinalSelect = screen.getByLabelText(/occurrence dans le mois/i) as HTMLSelectElement;
    expect(ordinalSelect.tagName).toBe("SELECT");
    // Has ordinal options
    expect(screen.getByRole("option", { name: "1er" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dernier" })).toBeInTheDocument();

    // dayOfWeek select
    expect(screen.getByLabelText(/jour de la semaine/i)).toBeInTheDocument();

    // monthlyDayOfMonth is gone
    expect(screen.queryByLabelText(/jour du mois/i)).not.toBeInTheDocument();

    // day-of-week pills (WEEKLY multi-pick) are gone
    expect(screen.queryByText("Lun")).not.toBeInTheDocument();
  });

  // 4. Submit MONTHLY_DAY payload
  it("4. submit MONTHLY_DAY avec monthlyDayOfMonth=15 → payload correct sans dayOfWeek ni weekInterval", async () => {
    renderModal();
    await openCreateForm();

    // Switch to MONTHLY_DAY
    fireEvent.click(screen.getByRole("radio", { name: /mensuelle à date fixe/i }));

    // Select user (checkbox)
    const checkbox = screen.getByRole("checkbox", { name: /alice dupont/i });
    fireEvent.click(checkbox);

    // Set day of month to 15
    const dayInput = screen.getByLabelText(/jour du mois/i);
    fireEvent.change(dayInput, { target: { value: "15" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: /créer/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateRecurringRule).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrenceType: "MONTHLY_DAY",
          monthlyDayOfMonth: 15,
        }),
      );
    });

    // Ensure dayOfWeek and weekInterval are absent (or null)
    const call = mockCreateRecurringRule.mock.calls[0][0] as Record<string, unknown>;
    expect(call.dayOfWeek == null).toBe(true);
    expect(call.weekInterval == null).toBe(true);
  });

  // 5. Submit MONTHLY_ORDINAL payload
  it("5. submit MONTHLY_ORDINAL avec ordinal=3, dayOfWeek=TUESDAY → payload correct", async () => {
    renderModal();
    await openCreateForm();

    // Switch to MONTHLY_ORDINAL
    fireEvent.click(screen.getByRole("radio", { name: /mensuelle ordinale/i }));

    // Select user
    const checkbox = screen.getByRole("checkbox", { name: /alice dupont/i });
    fireEvent.click(checkbox);

    // Set ordinal to 3
    const ordinalSelect = screen.getByLabelText(/occurrence dans le mois/i);
    fireEvent.change(ordinalSelect, { target: { value: "3" } });

    // Set dayOfWeek to TUESDAY
    const dowSelect = screen.getByLabelText(/jour de la semaine/i);
    fireEvent.change(dowSelect, { target: { value: "TUESDAY" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /créer/i }));

    await waitFor(() => {
      expect(mockCreateRecurringRule).toHaveBeenCalledWith(
        expect.objectContaining({
          recurrenceType: "MONTHLY_ORDINAL",
          monthlyOrdinal: 3,
          dayOfWeek: "TUESDAY",
        }),
      );
    });
  });

  // 6. Edit an existing MONTHLY_DAY rule pre-fills the form
  it("6. édition d'une règle MONTHLY_DAY existante pré-sélectionne bien le mode et monthlyDayOfMonth", async () => {
    renderModal([monthlyDayRule]);

    // Click the Edit button on the rule row
    const editBtn = screen.getByRole("button", { name: /modifier/i });
    fireEvent.click(editBtn);

    // Wait for form
    await waitFor(() => {
      expect(screen.getByText("Type de récurrence")).toBeInTheDocument();
    });

    // MONTHLY_DAY radio is checked
    const monthlyDayRadio = screen.getByRole("radio", { name: /mensuelle à date fixe/i });
    expect(monthlyDayRadio).toBeChecked();

    // monthlyDayOfMonth is pre-filled with 15
    const dayInput = screen.getByLabelText(/jour du mois/i) as HTMLInputElement;
    expect(dayInput.value).toBe("15");
  });
});
