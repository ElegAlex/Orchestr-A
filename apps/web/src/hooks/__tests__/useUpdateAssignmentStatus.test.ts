import { renderHook, act } from "@testing-library/react";
import { useUpdateAssignmentStatus } from "../useUpdateAssignmentStatus";
import { predefinedTasksService } from "@/services/predefined-tasks.service";
import toast from "react-hot-toast";

jest.mock("@/services/predefined-tasks.service", () => ({
  predefinedTasksService: {
    updateCompletionStatus: jest.fn(),
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockUpdateCompletionStatus = predefinedTasksService.updateCompletionStatus as jest.Mock;

const MOCK_ASSIGNMENT = {
  id: "assign-1",
  predefinedTaskId: "pt-1",
  userId: "user-1",
  date: "2026-04-24",
  period: "FULL_DAY" as const,
  createdById: "user-1",
  createdAt: "2026-04-24T08:00:00Z",
  updatedAt: "2026-04-24T08:00:00Z",
  completionStatus: "DONE" as const,
};

describe("useUpdateAssignmentStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls predefinedTasksService.updateCompletionStatus with correct args", async () => {
    mockUpdateCompletionStatus.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useUpdateAssignmentStatus({ onSuccess }),
    );

    await act(async () => {
      await result.current.mutate({
        assignmentId: "assign-1",
        status: "DONE",
      });
    });

    expect(mockUpdateCompletionStatus).toHaveBeenCalledWith("assign-1", {
      status: "DONE",
      reason: undefined,
    });
  });

  it("calls predefinedTasksService with reason when provided", async () => {
    mockUpdateCompletionStatus.mockResolvedValueOnce(MOCK_ASSIGNMENT);

    const { result } = renderHook(() => useUpdateAssignmentStatus({}));

    await act(async () => {
      await result.current.mutate({
        assignmentId: "assign-1",
        status: "NOT_APPLICABLE",
        reason: "report décision tutelle",
      });
    });

    expect(mockUpdateCompletionStatus).toHaveBeenCalledWith("assign-1", {
      status: "NOT_APPLICABLE",
      reason: "report décision tutelle",
    });
  });

  it("shows success toast and calls onSuccess on successful mutation", async () => {
    mockUpdateCompletionStatus.mockResolvedValueOnce(MOCK_ASSIGNMENT);
    const onSuccess = jest.fn();

    const { result } = renderHook(() =>
      useUpdateAssignmentStatus({ onSuccess }),
    );

    await act(async () => {
      await result.current.mutate({ assignmentId: "assign-1", status: "DONE" });
    });

    expect(toast.success).toHaveBeenCalledWith("Statut mis à jour");
    expect(onSuccess).toHaveBeenCalledWith(MOCK_ASSIGNMENT);
  });

  it("shows 'Permission refusée' toast on 403 error", async () => {
    const error = Object.assign(new Error("Forbidden"), {
      response: { status: 403 },
    });
    mockUpdateCompletionStatus.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useUpdateAssignmentStatus({}));

    await act(async () => {
      await result.current.mutate({ assignmentId: "assign-1", status: "DONE" });
    });

    expect(toast.error).toHaveBeenCalledWith("Permission refusée");
  });

  it("shows 'Transition invalide' toast on 409 error", async () => {
    const error = Object.assign(new Error("Conflict"), {
      response: { status: 409 },
    });
    mockUpdateCompletionStatus.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useUpdateAssignmentStatus({}));

    await act(async () => {
      await result.current.mutate({ assignmentId: "assign-1", status: "DONE" });
    });

    expect(toast.error).toHaveBeenCalledWith("Transition invalide");
  });

  it("shows backend message on 400 error", async () => {
    const error = Object.assign(new Error("Bad Request"), {
      response: { status: 400, data: { message: "reason is required" } },
    });
    mockUpdateCompletionStatus.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useUpdateAssignmentStatus({}));

    await act(async () => {
      await result.current.mutate({
        assignmentId: "assign-1",
        status: "NOT_APPLICABLE",
      });
    });

    expect(toast.error).toHaveBeenCalledWith("reason is required");
  });

  it("shows generic error toast on unknown error", async () => {
    mockUpdateCompletionStatus.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useUpdateAssignmentStatus({}));

    await act(async () => {
      await result.current.mutate({ assignmentId: "assign-1", status: "DONE" });
    });

    expect(toast.error).toHaveBeenCalledWith("Erreur lors de la mise à jour");
  });

  it("sets isPending=true during mutation and false after", async () => {
    let resolvePromise: (v: typeof MOCK_ASSIGNMENT) => void;
    mockUpdateCompletionStatus.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => useUpdateAssignmentStatus({}));

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.mutate({ assignmentId: "assign-1", status: "DONE" });
    });

    expect(result.current.isPending).toBe(true);

    await act(async () => {
      resolvePromise!(MOCK_ASSIGNMENT);
    });

    expect(result.current.isPending).toBe(false);
  });
});
