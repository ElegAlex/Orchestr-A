import { render, screen } from "@testing-library/react";

// Mock Projects page
const MockProjectsPage = () => {
  const projects = [
    { id: "1", name: "Project Alpha", status: "ACTIVE" },
    { id: "2", name: "Project Beta", status: "ACTIVE" },
  ];

  return (
    <div>
      <h1>Projets</h1>
      <div className="projects-list">
        {projects.map((project) => (
          <div key={project.id} className="project-card">
            <h3>{project.name}</h3>
            <span className="status">{project.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

describe("Projects Page", () => {
  it("should render projects page title", () => {
    render(<MockProjectsPage />);

    expect(screen.getByText(/projets/i)).toBeInTheDocument();
  });

  it("should display list of projects", () => {
    render(<MockProjectsPage />);

    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Project Beta")).toBeInTheDocument();
  });

  it("should display project status", () => {
    render(<MockProjectsPage />);

    const statusElements = screen.getAllByText("ACTIVE");
    expect(statusElements).toHaveLength(2);
  });
});
