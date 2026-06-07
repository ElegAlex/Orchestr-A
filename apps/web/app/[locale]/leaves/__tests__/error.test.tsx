import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// OBS-018 — Leaves error boundary (error.tsx) renders a user-facing fallback
// with a "Réessayer" retry button instead of crashing the route segment.
// ---------------------------------------------------------------------------

jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn() },
}));

import LeavesError from "../error";

describe("OBS-018 — LeavesError boundary component", () => {
  const testError = new Error("Test render failure");
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("OBS-018 — renders a user-facing error message", () => {
    render(<LeavesError error={testError} reset={mockReset} />);
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
  });

  it("OBS-018 — renders a Réessayer retry button", () => {
    render(<LeavesError error={testError} reset={mockReset} />);
    expect(
      screen.getByRole("button", { name: /Réessayer/i }),
    ).toBeInTheDocument();
  });

  it("OBS-018 — calls reset when the retry button is clicked", () => {
    render(<LeavesError error={testError} reset={mockReset} />);
    fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("OBS-018 — logs the error via logger.error on mount", () => {
    const { logger } = jest.requireMock("@/lib/logger");
    render(<LeavesError error={testError} reset={mockReset} />);
    expect(logger.error).toHaveBeenCalledWith(
      "Leaves page render error:",
      testError,
    );
  });
});
