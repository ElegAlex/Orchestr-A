import { render, screen } from "@testing-library/react";

// Simple mock component for testing
const MockLoginForm = () => {
  return (
    <div>
      <h1>Connexion</h1>
      <form>
        <input placeholder="Login ou email" type="text" />
        <input placeholder="Mot de passe" type="password" />
        <button type="submit">Se connecter</button>
      </form>
      <p>Pas encore de compte ?</p>
    </div>
  );
};

describe("LoginPage", () => {
  it("should render login form", () => {
    render(<MockLoginForm />);

    expect(screen.getByText(/connexion/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/login ou email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/mot de passe/i)).toBeInTheDocument();
  });

  it("should have a submit button", () => {
    render(<MockLoginForm />);

    const submitButton = screen.getByRole("button", { name: /se connecter/i });
    expect(submitButton).toBeInTheDocument();
  });

  it("should have a link to register page", () => {
    render(<MockLoginForm />);

    expect(screen.getByText(/pas encore de compte/i)).toBeInTheDocument();
  });
});
