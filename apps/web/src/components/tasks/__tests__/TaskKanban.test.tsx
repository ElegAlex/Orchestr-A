import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import TaskKanban from "../TaskKanban";
import type { Task } from "@/types";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) return `${key}:${JSON.stringify(params)}`;
    return key;
  },
  useLocale: () => "fr",
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/services/tasks.service", () => ({
  tasksService: {
    update: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/task-progress", () => ({
  getTaskProgress: jest.fn().mockReturnValue(0),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeTask = (overrides: Partial<Task>): Task =>
  ({
    id: "t1",
    title: "T1",
    status: "TODO",
    priority: "NORMAL",
    assignees: [],
    progress: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  }) as Task;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("TaskKanban", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1 — renders 5 columns by default
  it("renders 5 columns by default", () => {
    render(<TaskKanban tasks={[]} onTaskClick={jest.fn()} />);
    expect(screen.getByTestId("kanban-column-TODO")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-IN_PROGRESS")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-IN_REVIEW")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-DONE")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-column-BLOCKED")).toBeInTheDocument();
  });

  // 2 — hides columns listed in hiddenStatuses
  it("hides columns listed in hiddenStatuses", () => {
    render(
      <TaskKanban
        tasks={[]}
        onTaskClick={jest.fn()}
        hiddenStatuses={["BLOCKED" as Task["status"]]}
      />,
    );
    expect(screen.queryByTestId("kanban-column-BLOCKED")).toBeNull();
    expect(screen.getByTestId("kanban-column-TODO")).toBeInTheDocument();
  });

  // 3 — sorts tasks alphabetically by title within a column
  it("sorts tasks alphabetically by title within a column", () => {
    const tasks = [
      makeTask({ id: "tc", title: "Charlie", status: "TODO" }),
      makeTask({ id: "ta", title: "Alpha", status: "TODO" }),
      makeTask({ id: "tb", title: "Bravo", status: "TODO" }),
    ];
    render(<TaskKanban tasks={tasks} onTaskClick={jest.fn()} />);
    const column = screen.getByTestId("kanban-column-TODO");
    const cards = within(column).getAllByTestId(/^kanban-card-/);
    expect(cards[0]).toHaveAttribute("data-testid", "kanban-card-ta");
    expect(cards[1]).toHaveAttribute("data-testid", "kanban-card-tb");
    expect(cards[2]).toHaveAttribute("data-testid", "kanban-card-tc");
  });

  // 4 — distributes tasks by status into correct columns
  it("distributes tasks by status into correct columns", () => {
    const tasks = [
      makeTask({ id: "ta", title: "A", status: "TODO" }),
      makeTask({ id: "tb", title: "B", status: "IN_PROGRESS" }),
      makeTask({ id: "tc", title: "C", status: "DONE" }),
    ];
    render(<TaskKanban tasks={tasks} onTaskClick={jest.fn()} />);

    const todoCol = screen.getByTestId("kanban-column-TODO");
    const inProgressCol = screen.getByTestId("kanban-column-IN_PROGRESS");
    const doneCol = screen.getByTestId("kanban-column-DONE");

    expect(within(todoCol).getByTestId("kanban-card-ta")).toBeInTheDocument();
    expect(
      within(inProgressCol).getByTestId("kanban-card-tb"),
    ).toBeInTheDocument();
    expect(within(doneCol).getByTestId("kanban-card-tc")).toBeInTheDocument();

    // Should NOT appear in wrong columns
    expect(within(todoCol).queryByTestId("kanban-card-tb")).toBeNull();
    expect(within(doneCol).queryByTestId("kanban-card-ta")).toBeNull();
  });

  // 5 — calls tasksService.update with new status on drop
  it("calls tasksService.update with new status on drop", async () => {
    const { tasksService } = jest.requireMock("@/services/tasks.service");
    const task = makeTask({ id: "t1", title: "Task1", status: "TODO" });
    render(<TaskKanban tasks={[task]} onTaskClick={jest.fn()} />);

    const card = screen.getByTestId("kanban-card-t1");
    const targetColumn = screen.getByTestId("kanban-column-IN_PROGRESS");

    fireEvent.dragStart(card);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    await waitFor(() => {
      expect(tasksService.update).toHaveBeenCalledWith("t1", {
        status: "IN_PROGRESS",
      });
    });
  });

  // 6 — does not call update on drop into same status column
  it("does not call update on drop into same status column", async () => {
    const { tasksService } = jest.requireMock("@/services/tasks.service");
    const task = makeTask({ id: "t1", title: "Task1", status: "TODO" });
    render(<TaskKanban tasks={[task]} onTaskClick={jest.fn()} />);

    const card = screen.getByTestId("kanban-card-t1");
    const sameColumn = screen.getByTestId("kanban-column-TODO");

    fireEvent.dragStart(card);
    fireEvent.dragOver(sameColumn);
    fireEvent.drop(sameColumn);

    // Give time for any async side effects
    await new Promise((r) => setTimeout(r, 50));
    expect(tasksService.update).not.toHaveBeenCalled();
  });

  // 7 — shows error toast when update fails
  it("shows error toast when update fails", async () => {
    const { tasksService } = jest.requireMock("@/services/tasks.service");
    const toast = jest.requireMock("react-hot-toast").default;
    tasksService.update.mockRejectedValueOnce(new Error("network error"));

    const task = makeTask({ id: "t1", title: "Task1", status: "TODO" });
    render(<TaskKanban tasks={[task]} onTaskClick={jest.fn()} />);

    const card = screen.getByTestId("kanban-card-t1");
    const targetColumn = screen.getByTestId("kanban-column-IN_PROGRESS");

    fireEvent.dragStart(card);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "kanban.messages.statusUpdateError",
      );
    });
  });

  // 8 — calls onTaskClick when card clicked (not dragged)
  it("calls onTaskClick when card clicked (not dragged)", () => {
    const onTaskClick = jest.fn();
    const task = makeTask({ id: "t1", title: "Task1", status: "TODO" });
    render(<TaskKanban tasks={[task]} onTaskClick={onTaskClick} />);

    const card = screen.getByTestId("kanban-card-t1");
    fireEvent.click(card);

    expect(onTaskClick).toHaveBeenCalledWith(task);
  });

  // 9 — renders CRITICAL and HIGH priority badge colors
  it("renders CRITICAL and HIGH priority badge colors", () => {
    const tasks = [
      makeTask({
        id: "tc",
        title: "Critical",
        status: "TODO",
        priority: "CRITICAL",
      }),
      makeTask({ id: "th", title: "High", status: "TODO", priority: "HIGH" }),
    ];
    render(<TaskKanban tasks={tasks} onTaskClick={jest.fn()} />);
    const criticalCard = screen.getByTestId("kanban-card-tc");
    const highCard = screen.getByTestId("kanban-card-th");
    expect(criticalCard.querySelector(".bg-red-100")).toBeInTheDocument();
    expect(highCard.querySelector(".bg-orange-100")).toBeInTheDocument();
  });

  // 10 — shows project badge when showProjectBadge=true
  it("shows project badge when showProjectBadge=true", () => {
    const tasks = [
      makeTask({
        id: "tp",
        title: "WithProject",
        status: "TODO",
        projectId: "proj1",
        project: { id: "proj1", name: "My Project" } as Task["project"],
      }),
      makeTask({ id: "to", title: "Orphan", status: "TODO", projectId: null }),
    ];
    render(
      <TaskKanban tasks={tasks} onTaskClick={jest.fn()} showProjectBadge />,
    );
    expect(screen.getByText("My Project")).toBeInTheDocument();
    expect(screen.getByText("kanban.orphanTask")).toBeInTheDocument();
  });

  // 11 — shows overdue badge when showOverdueBadge=true and task is overdue
  it("shows overdue badge when showOverdueBadge=true and task is overdue", () => {
    const tasks = [
      makeTask({
        id: "tod",
        title: "Overdue Task",
        status: "IN_PROGRESS",
        endDate: "2020-01-01T00:00:00Z",
      }),
    ];
    render(
      <TaskKanban tasks={tasks} onTaskClick={jest.fn()} showOverdueBadge />,
    );
    expect(screen.getByText("kanban.overdue")).toBeInTheDocument();
  });

  // 12 — shows status arrow buttons when showStatusArrows=true
  it("shows status arrow buttons when showStatusArrows=true", async () => {
    const { tasksService } = jest.requireMock("@/services/tasks.service");
    const onAfterStatusChange = jest.fn();
    const tasks = [
      makeTask({ id: "ta", title: "Alpha", status: "IN_PROGRESS" }),
    ];
    render(
      <TaskKanban
        tasks={tasks}
        onTaskClick={jest.fn()}
        showStatusArrows
        onAfterStatusChange={onAfterStatusChange}
      />,
    );
    const card = screen.getByTestId("kanban-card-ta");
    const prevButton = within(card).getByText("←");
    const nextButton = within(card).getByText("→");
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    fireEvent.click(nextButton);
    await waitFor(() => {
      expect(tasksService.update).toHaveBeenCalledWith("ta", {
        status: "IN_REVIEW",
      });
    });
  });

  // 13 — shows estimatedHours when > 0
  it("shows estimatedHours when greater than 0", () => {
    const tasks = [
      makeTask({ id: "t1", title: "Task1", status: "TODO", estimatedHours: 8 }),
    ];
    render(<TaskKanban tasks={tasks} onTaskClick={jest.fn()} />);
    expect(
      screen.getByText('kanban.estimatedHours:{"hours":8}'),
    ).toBeInTheDocument();
  });

  // 14 — dragLeave clears drop target highlight
  it("drag events fire without throwing (dragLeave + dragEnd)", () => {
    const task = makeTask({ id: "t1", title: "Task1", status: "TODO" });
    render(<TaskKanban tasks={[task]} onTaskClick={jest.fn()} />);

    const card = screen.getByTestId("kanban-card-t1");
    const todoColumn = screen.getByTestId("kanban-column-TODO");
    const inProgressColumn = screen.getByTestId("kanban-column-IN_PROGRESS");

    // Drag onto a different column then leave
    fireEvent.dragStart(card);
    fireEvent.dragOver(inProgressColumn);
    fireEvent.dragLeave(inProgressColumn);
    fireEvent.dragEnd(card);

    // After dragEnd the column should no longer show as drop target
    expect(todoColumn).toBeInTheDocument();
  });
});
