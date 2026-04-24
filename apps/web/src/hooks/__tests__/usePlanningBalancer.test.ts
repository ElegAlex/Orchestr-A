import { renderHook, act } from "@testing-library/react";
import { usePlanningBalancer } from "../usePlanningBalancer";
import { predefinedTasksService } from "@/services/predefined-tasks.service";
import toast from "react-hot-toast";

jest.mock("@/services/predefined-tasks.service", () => ({
  predefinedTasksService: {
    generateBalanced: jest.fn(),
  },
}));

jest.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGenerateBalanced = predefinedTasksService.generateBalanced as jest.Mock;

const MOCK_DTO = {
  startDate: "2026-05-01",
  endDate: "2026-05-31",
  taskIds: ["task-1"],
  userIds: ["user-1"],
  mode: "preview" as const,
};

const MOCK_RESULT = {
  mode: "preview" as const,
  proposedAssignments: [
    { taskId: "task-1", userId: "user-1", date: "2026-05-05", period: "FULL_DAY" as const, weight: 1 },
  ],
  workloadByAgent: [{ userId: "user-1", weightedLoad: 10 }],
  equityRatio: 0.92,
  unassignedOccurrences: [],
  assignmentsCreated: 0,
};

describe("usePlanningBalancer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preview() returns BalancerResult on success", async () => {
    mockGenerateBalanced.mockResolvedValueOnce(MOCK_RESULT);

    const { result } = renderHook(() => usePlanningBalancer());

    let returned: ReturnType<typeof result.current.preview> extends Promise<infer T> ? T : never;
    await act(async () => {
      returned = await result.current.preview(MOCK_DTO) as typeof returned;
    });

    expect(mockGenerateBalanced).toHaveBeenCalledWith({ ...MOCK_DTO, mode: "preview" });
    expect(returned!).toEqual(MOCK_RESULT);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("apply() on success shows toast with count and calls onApplied", async () => {
    const applyResult = { ...MOCK_RESULT, mode: "apply" as const, assignmentsCreated: 5 };
    mockGenerateBalanced.mockResolvedValueOnce(applyResult);
    const onApplied = jest.fn();

    const { result } = renderHook(() => usePlanningBalancer({ onApplied }));

    await act(async () => {
      await result.current.apply(MOCK_DTO);
    });

    expect(mockGenerateBalanced).toHaveBeenCalledWith({ ...MOCK_DTO, mode: "apply" });
    expect(toast.success).toHaveBeenCalledWith("5 assignation(s) créée(s)");
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("shows idempotent toast when assignmentsCreated is 0", async () => {
    const applyResult = { ...MOCK_RESULT, mode: "apply" as const, assignmentsCreated: 0 };
    mockGenerateBalanced.mockResolvedValueOnce(applyResult);
    const onApplied = jest.fn();

    const { result } = renderHook(() => usePlanningBalancer({ onApplied }));

    await act(async () => {
      await result.current.apply(MOCK_DTO);
    });

    expect(toast.success).toHaveBeenCalledWith("Aucune nouvelle assignation (plage déjà couverte)");
    expect(onApplied).toHaveBeenCalledTimes(1);
  });

  it("403 → shows 'Permission refusée' toast", async () => {
    const error = Object.assign(new Error("Forbidden"), {
      response: { status: 403 },
    });
    mockGenerateBalanced.mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePlanningBalancer());

    await act(async () => {
      const res = await result.current.preview(MOCK_DTO);
      expect(res).toBeUndefined();
    });

    expect(toast.error).toHaveBeenCalledWith("Permission refusée");
  });

  it("400 → shows backend message toast", async () => {
    const error = Object.assign(new Error("Bad Request"), {
      response: { status: 400, data: { message: "taskIds must not be empty" } },
    });
    mockGenerateBalanced.mockRejectedValueOnce(error);

    const { result } = renderHook(() => usePlanningBalancer());

    await act(async () => {
      await result.current.preview(MOCK_DTO);
    });

    expect(toast.error).toHaveBeenCalledWith("taskIds must not be empty");
  });

  it("500 → shows generic error toast", async () => {
    mockGenerateBalanced.mockRejectedValueOnce(new Error("Server Error"));

    const { result } = renderHook(() => usePlanningBalancer());

    await act(async () => {
      await result.current.preview(MOCK_DTO);
    });

    expect(toast.error).toHaveBeenCalledWith("Erreur lors de la génération");
  });

  it("isPending is true during request and false after", async () => {
    let resolvePromise!: (v: typeof MOCK_RESULT) => void;
    mockGenerateBalanced.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }),
    );

    const { result } = renderHook(() => usePlanningBalancer());

    expect(result.current.isPending).toBe(false);

    act(() => {
      result.current.preview(MOCK_DTO);
    });

    expect(result.current.isPending).toBe(true);

    await act(async () => {
      resolvePromise(MOCK_RESULT);
    });

    expect(result.current.isPending).toBe(false);
  });
});
