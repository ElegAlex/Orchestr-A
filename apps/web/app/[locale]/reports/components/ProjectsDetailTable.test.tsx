/**
 * COR-045 — Link href and router.push must include locale prefix.
 */
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { ProjectsDetailTable } from "./ProjectsDetailTable";
import type { ProjectDetail } from "../types";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock next/link — renders as <a> with the href prop
jest.mock("next/link", () =>
  function MockLink({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) {
    return <a href={href} {...rest}>{children}</a>;
  },
);

// Mock @/lib/api — useEffect calls api.get but we don't need data for this test
jest.mock("@/lib/api", () => ({
  api: { get: jest.fn(() => Promise.resolve({ data: [] })) },
}));

// Mock @/components/ProjectIcon
jest.mock("@/components/ProjectIcon", () => ({
  ProjectIcon: () => null,
}));

// Mock @/lib/logger
jest.mock("@/lib/logger", () => ({
  logger: { error: jest.fn() },
}));

const baseProject: ProjectDetail = {
  id: "proj-123",
  name: "Projet Alpha",
  code: "ALPHA",
  icon: null,
  status: "ACTIVE",
  progress: 50,
  totalTasks: 10,
  completedTasks: 5,
  isOverdue: false,
  dueDate: undefined,
  startDate: "2026-01-01",
  loggedHours: 20,
  budgetHours: 40,
  manager: null,
};

describe("ProjectsDetailTable — COR-045 locale-prefixed navigation", () => {
  it("renders project Link href with /{locale}/projects/{id}", async () => {
    await act(async () => {
      render(
        <ProjectsDetailTable
          projects={[baseProject]}
          dateRange="2026-01"
        />,
      );
    });

    const link = screen.getByRole("link", { name: /Projet Alpha/i });
    expect(link).toHaveAttribute("href", "/fr/projects/proj-123");
  });
});
