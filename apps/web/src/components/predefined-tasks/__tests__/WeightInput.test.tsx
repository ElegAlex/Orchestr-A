import { render, screen, fireEvent } from "@testing-library/react";
import { WeightInput } from "../WeightInput";

// Mock next-intl with actual FR label values from messages/fr/predefinedTasks.json
jest.mock("next-intl", () => ({
  useTranslations: () =>
    (key: string, params?: Record<string, string | number>) => {
      const translations: Record<string, string> = {
        "weight.label": "Poids / charge",
        "weight.hint":
          "Pondération utilisée par l'équilibrage automatique (1 = très légère, 5 = très lourde)",
        "weight.ariaLabel": params
          ? `Niveau de poids : ${params.level}`
          : "Niveau de poids : {level}",
        "weight.levels.1": "Très légère",
        "weight.levels.2": "Légère",
        "weight.levels.3": "Normale",
        "weight.levels.4": "Lourde",
        "weight.levels.5": "Très lourde",
      };
      return translations[key] ?? key;
    },
}));

describe("WeightInput", () => {
  const onChange = jest.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  // a. Rend 5 boutons avec les libellés français
  it("renders 5 buttons with French labels", () => {
    render(<WeightInput value={1} onChange={onChange} />);

    expect(screen.getByText("Très légère")).toBeInTheDocument();
    expect(screen.getByText("Légère")).toBeInTheDocument();
    expect(screen.getByText("Normale")).toBeInTheDocument();
    expect(screen.getByText("Lourde")).toBeInTheDocument();
    expect(screen.getByText("Très lourde")).toBeInTheDocument();

    // role="radio" because buttons have explicit role="radio"
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
  });

  // b. Le bouton correspondant à `value` a aria-pressed="true", les autres false
  it("sets aria-pressed=true only on the active button", () => {
    render(<WeightInput value={3} onChange={onChange} />);

    const radios = screen.getAllByRole("radio");
    // radios[0]=1, [1]=2, [2]=3, [3]=4, [4]=5
    expect(radios[0]).toHaveAttribute("aria-pressed", "false");
    expect(radios[1]).toHaveAttribute("aria-pressed", "false");
    expect(radios[2]).toHaveAttribute("aria-pressed", "true");
    expect(radios[3]).toHaveAttribute("aria-pressed", "false");
    expect(radios[4]).toHaveAttribute("aria-pressed", "false");
  });

  // c. Click sur un bouton appelle onChange(n) avec le bon n (1..5)
  it("calls onChange with the correct value when a button is clicked", () => {
    render(<WeightInput value={1} onChange={onChange} />);

    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[4]); // click on "Très lourde" = 5
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("calls onChange with value 2 when second button is clicked", () => {
    render(<WeightInput value={1} onChange={onChange} />);

    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[1]); // click on "Légère" = 2
    expect(onChange).toHaveBeenCalledWith(2);
  });

  // d. disabled désactive les 5 boutons
  it("disables all 5 buttons when disabled prop is true", () => {
    render(<WeightInput value={1} onChange={onChange} disabled />);

    // When disabled, testing-library may exclude from role="radio" tree;
    // use a direct DOM query as fallback
    const radios =
      screen.queryAllByRole("radio").length > 0
        ? screen.getAllByRole("radio")
        : Array.from(document.querySelectorAll("button"));
    expect(radios).toHaveLength(5);
    radios.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("does not call onChange when a disabled button is clicked", () => {
    render(<WeightInput value={1} onChange={onChange} disabled />);

    const radios =
      screen.queryAllByRole("radio").length > 0
        ? screen.getAllByRole("radio")
        : Array.from(document.querySelectorAll("button"));
    fireEvent.click(radios[2]);
    expect(onChange).not.toHaveBeenCalled();
  });

  // e. <fieldset> a role="radiogroup" et aria-labelledby
  it("fieldset has role=radiogroup and aria-labelledby", () => {
    render(<WeightInput value={1} onChange={onChange} id="pt-weight" />);

    const fieldset = screen.getByRole("radiogroup");
    expect(fieldset).toBeInTheDocument();

    const labelledBy = fieldset.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();

    // The element referenced by aria-labelledby should exist
    const legend = document.getElementById(labelledBy!);
    expect(legend).toBeInTheDocument();
  });
});
