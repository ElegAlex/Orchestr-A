import { ProjectDetail } from "../types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ProjectsTableProps {
  projects: ProjectDetail[];
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export function ProjectsTable({ projects }: ProjectsTableProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Détail des Projets</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Projet
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Progression
              </th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Tâches
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Chef de projet
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Heures Consommées
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Heures Budgétées
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                Échéance
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {projects.map((project) => (
              <tr key={project.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-semibold text-gray-900">
                    {project.name}
                  </div>
                  <div className="text-sm text-gray-900">{project.code}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      statusColors[project.status] ||
                      "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {project.status.replace("_", " ").toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {project.progress}%
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                  {project.completedTasks}/{project.totalTasks}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {project.projectManager || "-"}
                </td>
                <td
                  className={`px-6 py-4 whitespace-nowrap text-right text-sm ${
                    project.loggedHours > project.budgetHours
                      ? "text-red-600 font-semibold"
                      : "text-gray-900"
                  }`}
                >
                  {project.loggedHours}h
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                  {project.budgetHours}h
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex items-center gap-2">
                    {project.dueDate ? (
                      <span
                        className={
                          project.isOverdue
                            ? "text-red-600 font-semibold"
                            : "text-gray-900"
                        }
                      >
                        {format(new Date(project.dueDate), "dd/MM/yyyy", {
                          locale: fr,
                        })}
                      </span>
                    ) : (
                      <span className="text-gray-900">Non définie</span>
                    )}
                    {project.isOverdue && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Retard
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
