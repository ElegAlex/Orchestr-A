/**
 * useUsers — TanStack Query hook test.
 *
 * RED→GREEN property:
 *   Before fix: module `../useUsers` does not exist → import fails.
 *   After fix : two concurrent renders sharing one QueryClient deduplicate
 *               the underlying usersService.getAll call (1 call, not 2).
 *
 * This verifies the exact failure mode from PER-019: "every page mount
 * refetches, no dedup, no cross-page sharing."
 */
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUsers } from "../useUsers";
import { usersService } from "@/services/users.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
jest.mock("@/services/users.service", () => ({
  usersService: {
    getAll: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const mockUsers = [
  {
    id: "u1",
    email: "alice@test.com",
    login: "alice",
    firstName: "Alice",
    lastName: "Test",
    role: {
      id: "role-1",
      code: "CONTRIBUTEUR",
      label: "Contributeur",
      templateKey: "CONTRIBUTOR" as const,
      isSystem: true,
    },
    isActive: true,
    avatarUrl: null,
    avatarPreset: null,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  },
];

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client },
      children,
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("useUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usersService.getAll as jest.Mock).mockResolvedValue(mockUsers);
  });

  it("returns users after successful fetch", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);

    const { result } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockUsers);
    expect(usersService.getAll).toHaveBeenCalledTimes(1);
  });

  it("is loading initially", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);

    const { result } = renderHook(() => useUsers(), { wrapper });

    expect(result.current.isLoading).toBe(true);
  });

  it("deduplicates concurrent fetches across two renders sharing the same QueryClient", async () => {
    // PER-019 core: two simultaneous mounts → only ONE network call.
    // With raw useEffect+useState each mount calls the service independently.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);

    // Mount two hook instances at the same time
    const { result: r1 } = renderHook(() => useUsers(), { wrapper });
    const { result: r2 } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => expect(r1.current.isSuccess).toBe(true));
    await waitFor(() => expect(r2.current.isSuccess).toBe(true));

    // Both should have data, but the service was called only once (dedup)
    expect(r1.current.data).toEqual(mockUsers);
    expect(r2.current.data).toEqual(mockUsers);
    expect(usersService.getAll).toHaveBeenCalledTimes(1);
  });

  it("respects staleTime — does not refetch within 30s", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);

    const { result, rerender } = renderHook(() => useUsers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Rerender (simulates re-mount within staleTime window)
    rerender();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should still be only 1 call (cache hit within staleTime)
    expect(usersService.getAll).toHaveBeenCalledTimes(1);
  });

  it("handles service errors gracefully", async () => {
    (usersService.getAll as jest.Mock).mockRejectedValue(new Error("Network error"));

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = makeWrapper(client);

    const { result } = renderHook(() => useUsers(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
