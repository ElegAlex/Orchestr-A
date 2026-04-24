import { render, screen, fireEvent } from "@testing-library/react";
import { AssignmentStatusBadge } from "../AssignmentStatusBadge";
import type { PredefinedTaskAssignment } from "@/services/predefined-tasks.service";

jest.mock("next-intl", () => ({
  useTranslations: () =>
    (key: string, params?: Record<string, string | number>) => {
      const dict: Record<string, string> = {
        "status.NOT_DONE": "À faire",
        "status.IN_PROGRESS": "En cours",
        "status.DONE": "Fait",
        "status.NOT_APPLICABLE": "Non applicable",
        "status.LATE": "En retard",
        "status.ariaLabel.NOT_DONE": "Tâche à faire",
        "status.ariaLabel.IN_PROGRESS": "Tâche en cours",
        "status.ariaLabel.DONE": "Tâche faite",
        "status.ariaLabel.NOT_APPLICABLE": "Tâche non applicable",
        "status.ariaLabel.LATE": "Tâche en retard — à traiter",
        "status.transitionTo": `Passer à : ${params?.status ?? "{status}"}`,
        "status.reason.label": "Motif",
        "status.reason.placeholder": "Expliquer pourquoi...",
        "status.confirm": "Confirmer",
        "status.cancel": "Annuler",
        "status.notAllowed": "Vous n'avez pas le droit de modifier",
      };
      return dict[key] ?? key;
    },
}));

function buildAssignment(
  overrides: Partial<PredefinedTaskAssignment> = {},
): Pick<PredefinedTaskAssignment, "id" | "completionStatus" | "canUpdateStatus"> {
  return {
    id: "a1",
    completionStatus: "NOT_DONE",
    canUpdateStatus: true,
    ...overrides,
  };
}

describe("AssignmentStatusBadge", () => {
  const onTransition = jest.fn();

  beforeEach(() => {
    onTransition.mockClear();
  });

  // 1. Rend NOT_DONE collapsed avec aria-label correct
  it("rend le statut NOT_DONE avec aria-label 'Tâche à faire'", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment()}
        isLate={false}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    const badge = screen.getByRole("status", { name: "Tâche à faire" });
    expect(badge).toBeInTheDocument();
  });

  // 2. Rend DONE
  it("rend le statut DONE avec aria-label 'Tâche faite'", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment({ completionStatus: "DONE" })}
        isLate={false}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    expect(
      screen.getByRole("status", { name: "Tâche faite" }),
    ).toBeInTheDocument();
  });

  // 3. isLate=true + NOT_DONE → rendu LATE
  it("isLate=true sur NOT_DONE prend le pas : aria-label LATE", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment()}
        isLate={true}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    expect(
      screen.getByRole("status", { name: /en retard/i }),
    ).toBeInTheDocument();
  });

  // 4. canUpdateStatus=false + click : pas d'expansion
  it("canUpdateStatus=false : click ne déclenche pas d'expansion", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment({ canUpdateStatus: false })}
        isLate={false}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    const badge = screen.getByRole("status");
    fireEvent.click(badge);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // 5. canUpdateStatus=true + click : expansion avec chips des transitions valides
  it("canUpdateStatus=true + click : expansion affiche 3 chips pour NOT_DONE", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment()}
        isLate={false}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    fireEvent.click(screen.getByRole("status"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // Transitions depuis NOT_DONE : IN_PROGRESS, DONE, NOT_APPLICABLE
    expect(
      screen.getByRole("button", { name: /passer à : en cours/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /passer à : fait/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /passer à : non applicable/i }),
    ).toBeInTheDocument();
  });

  // 6. Click chip DONE : onTransition("DONE") appelé
  it("click chip DONE depuis NOT_DONE appelle onTransition('DONE')", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment()}
        isLate={false}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    fireEvent.click(screen.getByRole("status"));
    fireEvent.click(screen.getByRole("button", { name: /passer à : fait/i }));
    expect(onTransition).toHaveBeenCalledTimes(1);
    expect(onTransition).toHaveBeenCalledWith("DONE");
  });

  // 7. Click chip NOT_APPLICABLE : textarea apparaît, Valider désactivé
  it("click NOT_APPLICABLE affiche textarea, Valider désactivé si reason < 3", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment()}
        isLate={false}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    fireEvent.click(screen.getByRole("status"));
    fireEvent.click(
      screen.getByRole("button", { name: /passer à : non applicable/i }),
    );
    const textarea = screen.getByRole("textbox", { name: /motif/i });
    expect(textarea).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /confirmer/i });
    expect(confirm).toBeDisabled();
    expect(onTransition).not.toHaveBeenCalled();
  });

  // 8. Saisir reason + confirmer : onTransition("NOT_APPLICABLE", reason)
  it("saisir reason 'absence' + Confirmer appelle onTransition('NOT_APPLICABLE', 'absence')", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment()}
        isLate={false}
        onTransition={onTransition}
        viewMode="week"
      />,
    );
    fireEvent.click(screen.getByRole("status"));
    fireEvent.click(
      screen.getByRole("button", { name: /passer à : non applicable/i }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: /motif/i }), {
      target: { value: "absence" },
    });
    const confirm = screen.getByRole("button", { name: /confirmer/i });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    expect(onTransition).toHaveBeenCalledWith("NOT_APPLICABLE", "absence");
  });

  // 9. viewMode=month : pas d'interaction, juste un dot
  it("viewMode=month rend un point sans interaction", () => {
    render(
      <AssignmentStatusBadge
        assignment={buildAssignment({ completionStatus: "DONE" })}
        isLate={false}
        onTransition={onTransition}
        viewMode="month"
      />,
    );
    const dot = screen.getByRole("status", { name: "Tâche faite" });
    expect(dot).toBeInTheDocument();
    fireEvent.click(dot);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
