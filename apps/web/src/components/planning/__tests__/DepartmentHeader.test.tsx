/**
 * DepartmentHeader.test.tsx
 * Vérifie la bande de regroupement par département insérée dans le planning :
 *  - affiche le nom du département et le nombre d'agents (pluriel/singulier) ;
 *  - met en avant "Mon département" uniquement quand isCurrentUserDepartment.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DepartmentHeader } from "../DepartmentHeader";

jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "fr",
}));

describe("DepartmentHeader", () => {
  it("renders the department name and pluralized people count", () => {
    render(
      <DepartmentHeader
        name="Direction des Systèmes d'Information"
        userCount={4}
        isCurrentUserDepartment={false}
      />,
    );

    expect(
      screen.getByText("Direction des Systèmes d'Information"),
    ).toBeInTheDocument();
    // count + clé plurielle rendus dans le même nœud ("4 group.people")
    expect(screen.getByText(/4\s+group\.people/)).toBeInTheDocument();
    // pas de badge "mon département" quand ce n'est pas celui de l'utilisateur
    expect(screen.queryByText("department.mine")).not.toBeInTheDocument();
  });

  it("uses the singular label for a single person", () => {
    render(
      <DepartmentHeader
        name="RH"
        userCount={1}
        isCurrentUserDepartment={false}
      />,
    );

    expect(screen.getByText(/1\s+group\.person/)).toBeInTheDocument();
  });

  it("highlights the current user's department with the 'mine' badge", () => {
    render(
      <DepartmentHeader name="DSI" userCount={3} isCurrentUserDepartment />,
    );

    expect(screen.getByText("department.mine")).toBeInTheDocument();
  });
});
