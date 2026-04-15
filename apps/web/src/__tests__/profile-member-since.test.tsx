import { render, screen } from "@testing-library/react";
import { format, parseISO, isValid } from "date-fns";
import { fr, enUS } from "date-fns/locale";

// Mirrors the guarded renderer used in apps/web/app/[locale]/profile/page.tsx.
// Extracted as a tiny helper component so the assertion is decoupled from the
// full profile page (which pulls in next-intl, zustand, etc.).
function MemberSince({
  createdAt,
  locale = "fr",
}: {
  createdAt: string | null | undefined;
  locale?: "fr" | "en";
}) {
  return (
    <p data-testid="member-since">
      {createdAt && isValid(parseISO(createdAt))
        ? format(parseISO(createdAt), "PPP", {
            locale: locale === "en" ? enUS : fr,
          })
        : "—"}
    </p>
  );
}

describe("Profile 'Membre depuis' (BUG-06)", () => {
  it("renders em-dash when createdAt is undefined", () => {
    render(<MemberSince createdAt={undefined} />);
    expect(screen.getByTestId("member-since")).toHaveTextContent("—");
  });

  it("renders em-dash when createdAt is null", () => {
    render(<MemberSince createdAt={null} />);
    expect(screen.getByTestId("member-since")).toHaveTextContent("—");
  });

  it("renders em-dash when createdAt is an invalid string", () => {
    render(<MemberSince createdAt={"not-a-date"} />);
    expect(screen.getByTestId("member-since")).toHaveTextContent("—");
  });

  it("renders a formatted date when given a valid ISO string (fr)", () => {
    render(<MemberSince createdAt={"2024-06-15T10:30:00.000Z"} locale="fr" />);
    const text = screen.getByTestId("member-since").textContent ?? "";
    expect(text).not.toBe("—");
    expect(text).toMatch(/2024/);
    // French month for June
    expect(text.toLowerCase()).toContain("juin");
  });

  it("renders a formatted date when given a valid ISO string (en)", () => {
    render(<MemberSince createdAt={"2024-06-15T10:30:00.000Z"} locale="en" />);
    const text = screen.getByTestId("member-since").textContent ?? "";
    expect(text).toMatch(/2024/);
    expect(text).toContain("June");
  });
});
