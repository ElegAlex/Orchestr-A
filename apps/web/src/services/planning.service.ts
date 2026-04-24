import { api } from "@/lib/api";
import {
  Holiday,
  Leave,
  SchoolVacation,
  Service,
  Task,
  TeleworkSchedule,
  User,
} from "@/types";
import { Event } from "./events.service";
import { PredefinedTaskAssignment } from "./predefined-tasks.service";

export interface PlanningOverview {
  users: User[];
  services: Service[];
  tasks: Task[];
  leaves: Leave[];
  events: Event[];
  telework: TeleworkSchedule[];
  holidays: Holiday[];
  schoolVacations: SchoolVacation[];
  predefinedAssignments: PredefinedTaskAssignment[];
  settings: {
    lateThresholdDays: number;
  };
}

export const planningService = {
  /**
   * Récupère en un seul appel tout le payload planning pour la fenêtre
   * [startDate, endDate]. Remplace les 9 requêtes parallèles historiques
   * et élimine la pression sur le rate limit nginx.
   */
  async getOverview(
    startDate: string,
    endDate: string,
  ): Promise<PlanningOverview> {
    const params = new URLSearchParams({ startDate, endDate });
    const response = await api.get<PlanningOverview>(
      `/planning/overview?${params.toString()}`,
    );
    return response.data;
  },
};
