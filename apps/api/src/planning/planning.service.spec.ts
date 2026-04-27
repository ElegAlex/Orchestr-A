import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { PlanningService } from './planning.service';
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

describe('PlanningService', () => {
  let service: PlanningService;

  const paginated = <T>(data: T[]) => ({
    data,
    meta: { total: data.length, page: 1, limit: 1000, totalPages: 1 },
  });

  const mockUsersService = { findAll: vi.fn() };
  const mockServicesService = { findAll: vi.fn() };
  const mockTasksService = { findAll: vi.fn() };
  const mockLeavesService = { findAll: vi.fn() };
  const mockEventsService = { findAll: vi.fn() };
  const mockTeleworkService = {
    findAll: vi.fn(),
    findForPlanningOverview: vi.fn(),
  };
  const mockHolidaysService = { findByRange: vi.fn() };
  const mockSchoolVacationsService = { findByRange: vi.fn() };
  const mockPredefinedTasksService = { findAssignments: vi.fn() };
  const mockPermissionsService = { getPermissionsForRole: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockUsersService.findAll.mockResolvedValue(
      paginated([{ id: 'u1', isActive: true, userServices: [{ id: 'us1' }] }]),
    );
    mockServicesService.findAll.mockResolvedValue(paginated([{ id: 's1' }]));
    mockTasksService.findAll.mockResolvedValue(paginated([{ id: 't1' }]));
    mockLeavesService.findAll.mockResolvedValue(paginated([{ id: 'l1' }]));
    mockEventsService.findAll.mockResolvedValue([{ id: 'e1' }]);
    mockTeleworkService.findForPlanningOverview.mockResolvedValue([
      { id: 'tw1' },
    ]);
    mockHolidaysService.findByRange.mockResolvedValue([{ id: 'h1' }]);
    mockSchoolVacationsService.findByRange.mockResolvedValue([{ id: 'sv1' }]);
    mockPredefinedTasksService.findAssignments.mockResolvedValue([
      { id: 'pa1', userId: 'u1' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanningService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: ServicesService, useValue: mockServicesService },
        { provide: TasksService, useValue: mockTasksService },
        { provide: LeavesService, useValue: mockLeavesService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: TeleworkService, useValue: mockTeleworkService },
        { provide: HolidaysService, useValue: mockHolidaysService },
        {
          provide: SchoolVacationsService,
          useValue: mockSchoolVacationsService,
        },
        {
          provide: PredefinedTasksService,
          useValue: mockPredefinedTasksService,
        },
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    }).compile();

    service = module.get<PlanningService>(PlanningService);
  });

  const START = '2026-04-13T00:00:00.000Z';
  const END = '2026-04-19T23:59:59.999Z';
  const USER = { id: 'user-1', role: 'MANAGER' };

  it('retourne le payload agrégé avec les 9 datasets', async () => {
    mockPermissionsService.getPermissionsForRole.mockResolvedValue([
      'predefined_tasks:view',
      'tasks:readAll',
    ]);

    const result = await service.getOverview(START, END, USER);

    expect(result).toEqual({
      users: [{ id: 'u1', isActive: true, userServices: [{ id: 'us1' }] }],
      services: [{ id: 's1' }],
      tasks: [{ id: 't1' }],
      leaves: [{ id: 'l1' }],
      events: [{ id: 'e1' }],
      telework: [{ id: 'tw1' }],
      holidays: [{ id: 'h1' }],
      schoolVacations: [{ id: 'sv1' }],
      predefinedAssignments: [{ id: 'pa1', userId: 'u1' }],
    });
  });

  it("n'appelle pas findAssignments si le user n'a pas predefined_tasks:view", async () => {
    mockPermissionsService.getPermissionsForRole.mockResolvedValue([
      'tasks:readAll',
    ]);

    const result = await service.getOverview(START, END, USER);

    expect(mockPredefinedTasksService.findAssignments).not.toHaveBeenCalled();
    expect(result.predefinedAssignments).toEqual([]);
  });

  it('propage currentUser aux sous-services scopés par RBAC', async () => {
    mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);

    await service.getOverview(START, END, USER);

    expect(mockTasksService.findAll).toHaveBeenCalledWith(
      1,
      1000,
      undefined,
      undefined,
      undefined,
      START,
      END,
      undefined,
      USER,
    );
    expect(mockLeavesService.findAll).toHaveBeenCalledWith(
      1,
      1000,
      undefined,
      undefined,
      undefined,
      START,
      END,
      USER.id,
      USER.role,
    );
    expect(mockEventsService.findAll).toHaveBeenCalledWith(
      USER.id,
      USER.role,
      '2026-04-13',
      '2026-04-19',
    );
    expect(mockTeleworkService.findForPlanningOverview).toHaveBeenCalledWith(
      ['u1'],
      '2026-04-13',
      '2026-04-19',
    );
  });

  it('passe les dates tronquées aux endpoints qui attendent YYYY-MM-DD', async () => {
    mockPermissionsService.getPermissionsForRole.mockResolvedValue([
      'predefined_tasks:view',
    ]);

    await service.getOverview(START, END, USER);

    expect(mockHolidaysService.findByRange).toHaveBeenCalledWith(
      '2026-04-13',
      '2026-04-19',
    );
    expect(mockSchoolVacationsService.findByRange).toHaveBeenCalledWith(
      '2026-04-13',
      '2026-04-19',
    );
    expect(mockPredefinedTasksService.findAssignments).toHaveBeenCalledWith({
      startDate: '2026-04-13',
      endDate: '2026-04-19',
    });
  });

  it('limite les télétravails overview aux agents actifs visibles', async () => {
    mockPermissionsService.getPermissionsForRole.mockResolvedValue([]);
    mockUsersService.findAll.mockResolvedValue(
      paginated([
        { id: 'u1', isActive: true, userServices: [{ id: 'us1' }] },
        { id: 'u2', isActive: false, userServices: [{ id: 'us2' }] },
        { id: 'u3', isActive: true, userServices: [] },
      ]),
    );

    await service.getOverview(START, END, USER);

    expect(mockTeleworkService.findForPlanningOverview).toHaveBeenCalledWith(
      ['u1'],
      '2026-04-13',
      '2026-04-19',
    );
  });
});
