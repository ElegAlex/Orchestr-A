/**
 * OBS-026 / OBS-027 / OBS-028 — [locale] root error boundary smoke test.
 *
 * Verifies:
 *  1. The fallback UI is rendered (heading + retry button).
 *  2. Clicking the retry button invokes the `reset` callback.
 *  3. The logger is called with the error on mount.
 */

import { render, screen, fireEvent } from "@testing-library/react";

// Mock @/lib/logger — logger is a singleton with side-effects we don't need here.
// The factory must not reference variables declared after it (jest hoisting).
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import LocaleError from "../../app/[locale]/error";
import { logger } from "@/lib/logger";

const mockLoggerError = logger.error as jest.Mock;

describe("LocaleError boundary (OBS-026/027/028)", () => {
  const testError = new Error("Boom — render crashed");

  beforeEach(() => {
    mockLoggerError.mockClear();
  });

  it("renders the fallback heading", () => {
    render(<LocaleError error={testError} reset={() => {}} />);
    expect(
      screen.getByRole("heading", { name: /une erreur est survenue/i }),
    ).toBeInTheDocument();
  });

  it("renders a retry button", () => {
    render(<LocaleError error={testError} reset={() => {}} />);
    expect(
      screen.getByRole("button", { name: /réessayer/i }),
    ).toBeInTheDocument();
  });

  it("calls reset() when the retry button is clicked", () => {
    const reset = jest.fn();
    render(<LocaleError error={testError} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /réessayer/i }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("logs the error via logger on mount", () => {
    render(<LocaleError error={testError} reset={() => {}} />);
    expect(mockLoggerError).toHaveBeenCalledWith(
      "Application render error:",
      testError,
    );
  });
});
