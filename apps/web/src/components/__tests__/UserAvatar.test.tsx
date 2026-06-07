import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserAvatar } from "@/components/UserAvatar";
import api from "@/lib/api";

jest.mock("@/lib/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  api: { get: jest.fn() },
}));

const mockedGet = api.get as jest.Mock;

const user = { id: "1", firstName: "Alice", lastName: "Martin" };

describe("UserAvatar", () => {
  it("renders monogram when no avatarUrl nor avatarPreset", () => {
    render(<UserAvatar user={user} />);
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("renders image when avatarUrl is provided", () => {
    render(
      <UserAvatar user={{ ...user, avatarUrl: "/avatars/persona_01.svg" }} />,
    );
    const img = screen.getByAltText("Alice Martin");
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("persona_01.svg"),
    );
  });

  it("renders preset when avatarPreset is provided (not initials)", () => {
    render(<UserAvatar user={{ ...user, avatarPreset: "persona_03" }} />);
    const img = screen.getByAltText("Alice Martin");
    expect(img).toHaveAttribute("src", "/avatars/persona_03.svg");
  });

  it('renders monogram when avatarPreset is "initials"', () => {
    render(<UserAvatar user={{ ...user, avatarPreset: "initials" }} />);
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("renders badge when provided", () => {
    render(<UserAvatar user={user} badge={<span data-testid="b">★</span>} />);
    expect(screen.getByTestId("b")).toBeInTheDocument();
  });

  it("does not render badge when absent", () => {
    const { container } = render(<UserAvatar user={user} />);
    expect(
      container.querySelector('[class*="absolute"][class*="-top"]'),
    ).toBeNull();
  });

  it("falls back to monogram on image error", () => {
    render(<UserAvatar user={{ ...user, avatarPreset: "persona_03" }} />);
    const img = screen.getByAltText("Alice Martin");
    fireEvent.error(img);
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("renders title attribute with full name", () => {
    render(<UserAvatar user={user} />);
    expect(screen.getByTitle("Alice Martin")).toBeInTheDocument();
  });

  // SEC-016 — uploaded avatars (/api/uploads/*) are auth-gated and fetched as a
  // blob via the authenticated axios client, then rendered as an object URL.
  describe("uploaded avatar (auth-gated /api/uploads)", () => {
    const realCreate = URL.createObjectURL;
    beforeEach(() => {
      mockedGet.mockReset();
      URL.createObjectURL = jest.fn(() => "blob:mock-avatar");
    });
    afterEach(() => {
      URL.createObjectURL = realCreate;
    });

    it("fetches the avatar with the axios client and renders the object URL", async () => {
      mockedGet.mockResolvedValueOnce({ data: new Blob(["x"]) });
      render(
        <UserAvatar
          user={{ ...user, avatarUrl: "/api/uploads/avatars/sec016-a.png" }}
        />,
      );
      // axios baseURL is /api → the /api prefix is stripped before the call.
      await waitFor(() =>
        expect(mockedGet).toHaveBeenCalledWith(
          "/uploads/avatars/sec016-a.png",
          {
            responseType: "blob",
          },
        ),
      );
      const img = await screen.findByAltText("Alice Martin");
      expect(img).toHaveAttribute("src", "blob:mock-avatar");
    });

    it("falls back to the monogram when the authed fetch fails (e.g. 401)", async () => {
      mockedGet.mockRejectedValueOnce(new Error("401"));
      render(
        <UserAvatar
          user={{ ...user, avatarUrl: "/api/uploads/avatars/sec016-b.png" }}
        />,
      );
      await waitFor(() => expect(screen.getByText("AM")).toBeInTheDocument());
    });
  });
});
