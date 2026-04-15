import { render, screen } from "@testing-library/react";
import { TaskForm } from "../TaskForm";
import type { User, Project, Service } from "@/types";

// ─── Mocks ──────────────────────────────────────────────────────────────────
//
// TaskForm pulls in next-intl (translations), usePermissions (auth store),
// and the UserMultiSelect component. We mock the minimum surface so the
// component renders in a JSDOM environment without network or context.

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasPermission: () => false }),
}));

jest.mock("@/services/tasks.service", () => ({
  tasksService: {
    getSubtasks: jest.fn().mockResolvedValue([]),
    createSubtask: jest.fn(),
    updateSubtask: jest.fn(),
    deleteSubtask: jest.fn(),
  },
}));

jest.mock("@/services/projects.service", () => ({
  projectsService: {
    getById: jest.fn().mockResolvedValue({ members: [] }),
  },
}));

jest.mock("@/services/third-parties.service", () => ({
  thirdPartiesService: {
    listTaskAssignees: jest.fn().mockResolvedValue([]),
  },
}));

// UserMultiSelect: a minimal stand-in exposing the resolved users so tests
// can assert that the real list is rendered (not a skeleton).
jest.mock("@/components/UserMultiSelect", () => ({
  UserMultiSelect: ({
    label,
    users,
  }: {
    label: string;
    users: Array<{ id: string; firstName?: string; lastName?: string }>;
  }) => (
    <div data-testid="user-multi-select" aria-label={label}>
      <span data-testid="user-count">{users.length}</span>
      <ul>
        {users.map((u) => (
          <li key={u.id} data-testid={`user-option-${u.id}`}>
            {u.firstName} {u.lastName}
          </li>
        ))}
      </ul>
    </div>
  ),
}));

jest.mock("@/components/ServiceMultiSelect", () => ({
  ServiceMultiSelect: () => <div data-testid="service-multi-select" />,
}));

jest.mock("@/components/third-parties/ThirdPartySelector", () => ({
  ThirdPartySelector: () => <div data-testid="third-party-selector" />,
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

const sampleUsers = [
  { id: "u1", firstName: "Alice", lastName: "Dupont", email: "a@x" },
  { id: "u2", firstName: "Bob", lastName: "Martin", email: "b@x" },
] as unknown as User[];

const baseProps = {
  mode: "create" as const,
  projects: [] as Project[],
  services: [] as Service[],
  onSubmit: jest.fn(),
  onCancel: jest.fn(),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("TaskForm — BUG-02 assignees blink", () => {
  it("renders a skeleton placeholder (no empty UserMultiSelect) when users are loading", () => {
    render(
      <TaskForm
        {...baseProps}
        users={[]}
        isUsersLoading
      />,
    );

    expect(screen.getByTestId("assignees-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("assignees-skeleton")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByTestId("user-multi-select")).not.toBeInTheDocument();
  });

  it("renders the populated UserMultiSelect once users resolve", () => {
    render(
      <TaskForm
        {...baseProps}
        users={sampleUsers}
        isUsersLoading={false}
      />,
    );

    expect(screen.queryByTestId("assignees-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-multi-select")).toBeInTheDocument();
    expect(screen.getByTestId("user-count")).toHaveTextContent("2");
    expect(screen.getByTestId("user-option-u1")).toBeInTheDocument();
    expect(screen.getByTestId("user-option-u2")).toBeInTheDocument();
  });

  it("defaults to the populated select when isUsersLoading is omitted (backward compat)", () => {
    render(<TaskForm {...baseProps} users={sampleUsers} />);

    expect(screen.queryByTestId("assignees-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("user-multi-select")).toBeInTheDocument();
  });
});
