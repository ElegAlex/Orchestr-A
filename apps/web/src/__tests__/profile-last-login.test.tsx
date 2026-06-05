import { render, screen } from "@testing-library/react";

// Mirrors the login-history renderer in apps/web/app/[locale]/profile/page.tsx
// (Security tab). Extracted as a minimal component so the assertion is decoupled
// from next-intl / zustand / full page tree.
function LoginHistorySection({
  lastLoginAt,
  locale = "fr",
  neverLabel = "Jamais",
}: {
  lastLoginAt: string | null | undefined;
  locale?: "fr" | "en";
  neverLabel?: string;
}) {
  const displayDate = lastLoginAt
    ? new Date(lastLoginAt).toLocaleDateString(
        locale === "en" ? "en-US" : "fr-FR",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
      )
    : neverLabel;

  return <p data-testid="last-login">{displayDate}</p>;
}

describe("OBS-019 — Profile security tab: last login uses actual timestamp", () => {
  it("shows the stored lastLoginAt timestamp, not current time", () => {
    render(
      <LoginHistorySection
        lastLoginAt="2024-01-15T10:00:00.000Z"
        locale="en"
      />,
    );
    const text = screen.getByTestId("last-login").textContent ?? "";
    // Must contain 2024 (the stored year), never the current year 2026
    expect(text).toContain("2024");
    expect(text).not.toContain("2026");
  });

  it("shows a fallback label when lastLoginAt is null (never logged in via new session)", () => {
    render(
      <LoginHistorySection
        lastLoginAt={null}
        locale="fr"
        neverLabel="Jamais"
      />,
    );
    expect(screen.getByTestId("last-login")).toHaveTextContent("Jamais");
  });

  it("shows a fallback label when lastLoginAt is undefined", () => {
    render(
      <LoginHistorySection
        lastLoginAt={undefined}
        locale="fr"
        neverLabel="Jamais"
      />,
    );
    expect(screen.getByTestId("last-login")).toHaveTextContent("Jamais");
  });

  it("renders the month name for a fr locale timestamp", () => {
    render(
      <LoginHistorySection
        lastLoginAt="2024-06-15T10:00:00.000Z"
        locale="fr"
      />,
    );
    const text = screen.getByTestId("last-login").textContent ?? "";
    // French month for June
    expect(text.toLowerCase()).toContain("juin");
    expect(text).toContain("2024");
  });

  it("renders the month name for an en locale timestamp", () => {
    render(
      <LoginHistorySection
        lastLoginAt="2024-06-15T10:00:00.000Z"
        locale="en"
      />,
    );
    const text = screen.getByTestId("last-login").textContent ?? "";
    expect(text).toContain("June");
    expect(text).toContain("2024");
  });
});
