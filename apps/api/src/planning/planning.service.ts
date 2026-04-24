import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { TasksService } from '../tasks/tasks.service';
import { LeavesService } from '../leaves/leaves.service';
import { EventsService } from '../events/events.service';
import { TeleworkService } from '../telework/telework.service';
import { HolidaysService } from '../holidays/holidays.service';
import { SchoolVacationsService } from '../school-vacations/school-vacations.service';
import { PredefinedTasksService } from '../predefined-tasks/predefined-tasks.service';
import { PermissionsService } from '../rbac/permissions.service';
import { SettingsService } from '../settings/settings.service';

export interface PlanningOverview {
  users: unknown[];
  services: unknown[];
  tasks: unknown[];
  leaves: unknown[];
  events: unknown[];
  telework: unknown[];
  holidays: unknown[];
  schoolVacations: unknown[];
  predefinedAssignments: unknown[];
  settings: {
    lateThresholdDays: number;
  };
}

@Injectable()
export class PlanningService {
  private readonly logger = new Logger(PlanningService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly servicesService: ServicesService,
    private readonly tasksService: TasksService,
    private readonly leavesService: LeavesService,
    private readonly eventsService: EventsService,
    private readonly teleworkService: TeleworkService,
    private readonly holidaysService: HolidaysService,
    private readonly schoolVacationsService: SchoolVacationsService,
    private readonly predefinedTasksService: PredefinedTasksService,
    private readonly permissionsService: PermissionsService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Agrège en un seul appel toutes les données nécessaires à la vue planning
   * pour la fenêtre [startDate, endDate].
   *
   * Les sous-services appliquent eux-mêmes leur RBAC (tasks:readAll,
   * leaves:readAll, telework:readAll, events:readAll) via currentUserId/Role.
   * Les assignations de tâches prédéfinies ne sont incluses que si le user a
   * la permission `predefined_tasks:view`.
   */
  async getOverview(
    startDate: string,
    endDate: string,
    currentUser: { id: string; role: string | null },
  ): Promise<PlanningOverview> {
    const permissions = await this.permissionsService.getPermissionsForRole(
      currentUser.role,
    );
    const canViewPredefinedTasks = permissions.includes(
      'predefined_tasks:view',
    );

    const dateOnlyStart = startDate.slice(0, 10);
    const dateOnlyEnd = endDate.slice(0, 10);

    const [
      usersResult,
      servicesResult,
      tasksResult,
      leavesResult,
      events,
      teleworkResult,
      holidays,
      schoolVacations,
      predefinedAssignments,
    ] = await Promise.all([
      this.usersService.findAll(1, 1000),
      this.servicesService.findAll(1, 1000),
      this.tasksService.findAll(
        1,
        1000,
        undefined,
        undefined,
        undefined,
        startDate,
        endDate,
        undefined,
        currentUser,
      ),
      this.leavesService.findAll(
        1,
        1000,
        undefined,
        undefined,
        undefined,
        startDate,
        endDate,
        currentUser.id,
        currentUser.role ?? undefined,
      ),
      this.eventsService.findAll(
        currentUser.id,
        currentUser.role,
        dateOnlyStart,
        dateOnlyEnd,
      ),
      this.teleworkService.findAll(
        currentUser.id,
        currentUser.role,
        1,
        1000,
        undefined,
        dateOnlyStart,
        dateOnlyEnd,
      ),
      this.holidaysService.findByRange(dateOnlyStart, dateOnlyEnd),
      this.schoolVacationsService.findByRange(dateOnlyStart, dateOnlyEnd),
      canViewPredefinedTasks
        ? this.predefinedTasksService.findAssignments({
            startDate: dateOnlyStart,
            endDate: dateOnlyEnd,
          })
        : Promise.resolve([]),
    ]);

    // LeavesService.findAll retourne un array brut quand startDate/endDate
    // sont fournis, sinon un { data, meta } paginé. On couvre les deux cas.
    const leaves = Array.isArray(leavesResult)
      ? leavesResult
      : leavesResult.data;

    const lateThresholdDays = await this.settingsService.getValue<number>(
      'planning.lateThresholdDays',
      1,
    );

    return {
      users: usersResult.data,
      services: servicesResult.data,
      tasks: tasksResult.data,
      leaves,
      events,
      telework: teleworkResult.data,
      holidays,
      schoolVacations,
      predefinedAssignments,
      settings: { lateThresholdDays: Math.max(0, Math.floor(lateThresholdDays ?? 1)) },
    };
  }
}
