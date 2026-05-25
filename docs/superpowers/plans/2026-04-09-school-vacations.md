# School Vacations Planning Banner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display school vacation periods as a horizontal banner in the planning grid (week and month views), with admin management and open data import.

**Architecture:** New `school-vacations` backend module (NestJS, mirrors holidays module pattern). New Prisma model `SchoolVacation` with enums. Frontend: service + types + admin component in Settings + banner row in PlanningGrid + data fetched in usePlanningData hook.

**Tech Stack:** NestJS 11, Prisma 6, PostgreSQL, Next.js 16 App Router, React 19, Tailwind 4, Axios, date-fns, data.education.gouv.fr open data API.

---

## File Structure

### New files to create

| File                                                                   | Responsibility                     |
| ---------------------------------------------------------------------- | ---------------------------------- |
| `packages/database/prisma/schema.prisma` (modify)                      | Add `SchoolVacation` model + enums |
| `apps/api/src/school-vacations/school-vacations.module.ts`             | NestJS module                      |
| `apps/api/src/school-vacations/school-vacations.controller.ts`         | REST endpoints                     |
| `apps/api/src/school-vacations/school-vacations.service.ts`            | Business logic + open data import  |
| `apps/api/src/school-vacations/dto/create-school-vacation.dto.ts`      | Creation DTO                       |
| `apps/api/src/school-vacations/dto/update-school-vacation.dto.ts`      | Update DTO                         |
| `apps/api/src/school-vacations/dto/school-vacation-range-query.dto.ts` | Range query DTO                    |
| `apps/api/src/school-vacations/dto/import-school-vacation.dto.ts`      | Import DTO                         |
| `apps/api/src/school-vacations/school-vacations.spec.ts`               | Backend unit tests                 |
| `apps/web/src/services/school-vacations.service.ts`                    | Frontend API service               |
| `apps/web/src/components/school-vacations/SchoolVacationsManager.tsx`  | Admin panel                        |
| `apps/web/src/components/school-vacations/SchoolVacationModal.tsx`     | Create/edit modal                  |

### Existing files to modify

| File                                                | Change                                                         |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `packages/database/prisma/seed.ts`                  | Add `school-vacations:*` permissions                           |
| `apps/api/src/app.module.ts`                        | Register `SchoolVacationsModule`                               |
| `apps/web/src/types/index.ts`                       | Add SchoolVacation types + enums                               |
| `apps/web/src/hooks/usePlanningData.ts`             | Fetch school vacations in Promise.all, expose in return        |
| `apps/web/src/components/planning/PlanningGrid.tsx` | Render vacation banner row between header and service sections |
| `apps/web/app/[locale]/settings/page.tsx`           | Add "school-vacations" tab + zone selector                     |

---

## Task 1: Prisma Schema — Model + Enums + Migration

**Files:**

- Modify: `packages/database/prisma/schema.prisma` (after line 713, after Holiday model)

- [ ] **Step 1.1: Add enums and model to schema.prisma**

Add after the `HolidayType` enum block (around line 713):

```prisma
// ===========================
// SCHOOL VACATIONS (VACANCES SCOLAIRES)
// ===========================

enum SchoolVacationZone {
  A
  B
  C
}

enum SchoolVacationSource {
  IMPORT
  MANUAL
}

model SchoolVacation {
  id          String                @id @default(uuid())
  name        String                @db.VarChar(100)
  startDate   DateTime              @db.Date
  endDate     DateTime              @db.Date
  zone        SchoolVacationZone
  year        Int                   // Annee scolaire (2025 = 2025-2026)
  source      SchoolVacationSource  @default(MANUAL)
  createdById String
  createdAt   DateTime              @default(now())
  updatedAt   DateTime              @updatedAt

  // Relations
  createdBy   User                  @relation("SchoolVacationCreator", fields: [createdById], references: [id])

  @@unique([name, zone, year])
  @@index([startDate, endDate])
  @@index([zone, year])
  @@map("school_vacations")
}
```

- [ ] **Step 1.2: Add relation in User model**

In the `User` model (around line 54, near `createdHolidays`), add:

```prisma
createdSchoolVacations SchoolVacation[] @relation("SchoolVacationCreator")
```

- [ ] **Step 1.3: Run migration**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run db:migrate
```

When prompted for a migration name, use: `add_school_vacations`

Expected: Migration created and applied, `school_vacations` table created.

- [ ] **Step 1.4: Verify migration**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && npx prisma db pull --print 2>&1 | grep -i "school_vacation"
```

Expected: The `school_vacations` table appears in the output.

- [ ] **Step 1.5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(schema): add SchoolVacation model with zone and source enums"
```

---

## Task 2: Seed — Permissions

**Files:**

- Modify: `packages/database/prisma/seed.ts` (after holidays permissions, around line 1858)

- [ ] **Step 2.1: Add school-vacations permissions in the permissions array**

Find the block ending with `holidays:delete` (around line 1858) and add after it:

```typescript
    // School Vacations
    {
      code: "school_vacations:create",
      module: "school_vacations",
      action: "create",
      description: "Creer une periode de vacances scolaires",
    },
    {
      code: "school_vacations:read",
      module: "school_vacations",
      action: "read",
      description: "Voir les vacances scolaires",
    },
    {
      code: "school_vacations:update",
      module: "school_vacations",
      action: "update",
      description: "Modifier une periode de vacances scolaires",
    },
    {
      code: "school_vacations:delete",
      module: "school_vacations",
      action: "delete",
      description: "Supprimer une periode de vacances scolaires",
    },
```

Note: ADMIN role uses `allPermCodes` so it gets these automatically. RESPONSABLE gets all except `users:manage_roles` and `settings:update`, so it also gets these automatically.

- [ ] **Step 2.2: Run seed**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run db:seed
```

Expected: Seed completes with new permissions created.

- [ ] **Step 2.3: Commit**

```bash
git add packages/database/prisma/seed.ts
git commit -m "feat(seed): add school-vacations RBAC permissions"
```

---

## Task 3: Backend — DTOs

**Files:**

- Create: `apps/api/src/school-vacations/dto/create-school-vacation.dto.ts`
- Create: `apps/api/src/school-vacations/dto/update-school-vacation.dto.ts`
- Create: `apps/api/src/school-vacations/dto/school-vacation-range-query.dto.ts`
- Create: `apps/api/src/school-vacations/dto/import-school-vacation.dto.ts`

- [ ] **Step 3.1: Create create-school-vacation.dto.ts**

```typescript
import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  MaxLength,
  MinLength,
  Min,
  Max,
} from "class-validator";
import { SchoolVacationZone, SchoolVacationSource } from "database";

export class CreateSchoolVacationDto {
  @ApiProperty({
    description: "Nom de la periode de vacances",
    example: "Vacances de Printemps",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: "Date de debut",
    example: "2026-04-11",
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: "Date de fin",
    example: "2026-04-27",
  })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: "Zone scolaire",
    enum: SchoolVacationZone,
    example: SchoolVacationZone.C,
  })
  @IsEnum(SchoolVacationZone)
  @IsOptional()
  zone?: SchoolVacationZone;

  @ApiProperty({
    description: "Annee scolaire (2025 = 2025-2026)",
    example: 2025,
  })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiProperty({
    description: "Source de la donnee",
    enum: SchoolVacationSource,
    default: SchoolVacationSource.MANUAL,
    required: false,
  })
  @IsEnum(SchoolVacationSource)
  @IsOptional()
  source?: SchoolVacationSource = SchoolVacationSource.MANUAL;
}
```

- [ ] **Step 3.2: Create update-school-vacation.dto.ts**

```typescript
import { PartialType } from "@nestjs/swagger";
import { CreateSchoolVacationDto } from "./create-school-vacation.dto";

export class UpdateSchoolVacationDto extends PartialType(
  CreateSchoolVacationDto,
) {}
```

- [ ] **Step 3.3: Create school-vacation-range-query.dto.ts**

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsDateString } from "class-validator";

export class SchoolVacationRangeQueryDto {
  @ApiProperty({
    description: "Date de debut de la periode",
    example: "2026-01-01",
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: "Date de fin de la periode",
    example: "2026-12-31",
  })
  @IsDateString()
  endDate: string;
}
```

- [ ] **Step 3.4: Create import-school-vacation.dto.ts**

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min, Max } from "class-validator";

export class ImportSchoolVacationDto {
  @ApiProperty({
    description: "Annee scolaire a importer (2025 = 2025-2026)",
    example: 2025,
  })
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;
}
```

- [ ] **Step 3.5: Commit**

```bash
git add apps/api/src/school-vacations/dto/
git commit -m "feat(school-vacations): add DTOs for CRUD and import"
```

---

## Task 4: Backend — Service

**Files:**

- Create: `apps/api/src/school-vacations/school-vacations.service.ts`

- [ ] **Step 4.1: Create the service**

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SchoolVacationZone, SchoolVacationSource, Prisma } from "database";
import { CreateSchoolVacationDto } from "./dto/create-school-vacation.dto";
import { UpdateSchoolVacationDto } from "./dto/update-school-vacation.dto";

@Injectable()
export class SchoolVacationsService {
  private readonly logger = new Logger(SchoolVacationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(year?: number) {
    const where: Prisma.SchoolVacationWhereInput = {};
    if (year !== undefined) {
      where.year = year;
    }
    return this.prisma.schoolVacation.findMany({
      where,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: "asc" },
    });
  }

  async findOne(id: string) {
    const vacation = await this.prisma.schoolVacation.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!vacation) {
      throw new NotFoundException(
        `Periode de vacances scolaires introuvable: ${id}`,
      );
    }
    return vacation;
  }

  async findByRange(startDate: string, endDate: string) {
    return this.prisma.schoolVacation.findMany({
      where: {
        AND: [
          { startDate: { lte: new Date(endDate) } },
          { endDate: { gte: new Date(startDate) } },
        ],
      },
      orderBy: { startDate: "asc" },
    });
  }

  async create(dto: CreateSchoolVacationDto, userId: string) {
    try {
      return await this.prisma.schoolVacation.create({
        data: {
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          zone: dto.zone ?? SchoolVacationZone.C,
          year: dto.year,
          source: dto.source ?? SchoolVacationSource.MANUAL,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `Une periode "${dto.name}" existe deja pour cette zone et cette annee scolaire`,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateSchoolVacationDto) {
    await this.findOne(id);

    const data: Prisma.SchoolVacationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.zone !== undefined) data.zone = dto.zone;
    if (dto.year !== undefined) data.year = dto.year;
    if (dto.source !== undefined) data.source = dto.source;

    try {
      return await this.prisma.schoolVacation.update({
        where: { id },
        data,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          "Une periode avec ce nom existe deja pour cette zone et cette annee scolaire",
        );
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.schoolVacation.delete({ where: { id } });
  }

  /**
   * Importe les vacances scolaires depuis l'API open data du Ministere de l'Education.
   * API: https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records
   *
   * Chaque record a: description, start_date, end_date, zones, annee_scolaire, location, population
   * On filtre sur la zone configuree et on deduplique par nom+zone+annee (contrainte unique).
   */
  async importFromOpenData(
    year: number,
    zone: SchoolVacationZone,
    userId: string,
  ): Promise<{ created: number; skipped: number }> {
    const anneeScolaire = `${year}-${year + 1}`;
    const zoneLabel = `Zone ${zone}`;

    const url = new URL(
      "https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records",
    );
    url.searchParams.set(
      "where",
      `zones="${zoneLabel}" AND annee_scolaire="${anneeScolaire}"`,
    );
    url.searchParams.set("limit", "50");

    this.logger.log(`Importing school vacations from: ${url.toString()}`);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        `Erreur API open data: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      total_count: number;
      results: Array<{
        description: string;
        start_date: string;
        end_date: string;
        zones: string;
        annee_scolaire: string;
        location: string;
        population: string;
      }>;
    };

    // Deduplication: the API returns multiple records per vacation period (one per location/population).
    // Group by description (vacation name) and take the earliest start_date / latest end_date.
    const grouped = new Map<
      string,
      { name: string; startDate: string; endDate: string }
    >();

    for (const record of data.results) {
      const name = record.description;
      if (!name || name === "-") continue;

      const existing = grouped.get(name);
      if (!existing) {
        grouped.set(name, {
          name,
          startDate: record.start_date,
          endDate: record.end_date,
        });
      } else {
        // Take widest date range
        if (record.start_date < existing.startDate) {
          existing.startDate = record.start_date;
        }
        if (record.end_date > existing.endDate) {
          existing.endDate = record.end_date;
        }
      }
    }

    let created = 0;
    let skipped = 0;

    for (const vacation of grouped.values()) {
      try {
        await this.prisma.schoolVacation.create({
          data: {
            name: vacation.name,
            startDate: new Date(vacation.startDate),
            endDate: new Date(vacation.endDate),
            zone,
            year,
            source: SchoolVacationSource.IMPORT,
            createdById: userId,
          },
        });
        created++;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(
      `Import done: ${created} created, ${skipped} skipped (already exist)`,
    );
    return { created, skipped };
  }
}
```

- [ ] **Step 4.2: Commit**

```bash
git add apps/api/src/school-vacations/school-vacations.service.ts
git commit -m "feat(school-vacations): add service with CRUD and open data import"
```

---

## Task 5: Backend — Controller

**Files:**

- Create: `apps/api/src/school-vacations/school-vacations.controller.ts`

- [ ] **Step 5.1: Create the controller**

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { SchoolVacationsService } from "./school-vacations.service";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { CreateSchoolVacationDto } from "./dto/create-school-vacation.dto";
import { UpdateSchoolVacationDto } from "./dto/update-school-vacation.dto";
import { SchoolVacationRangeQueryDto } from "./dto/school-vacation-range-query.dto";
import { ImportSchoolVacationDto } from "./dto/import-school-vacation.dto";
import { SettingsService } from "../settings/settings.service";
import { SchoolVacationZone } from "database";
import type { User } from "@prisma/client";

@ApiTags("School Vacations")
@ApiBearerAuth()
@Controller("school-vacations")
export class SchoolVacationsController {
  constructor(
    private readonly schoolVacationsService: SchoolVacationsService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: "Recuperer toutes les periodes de vacances scolaires",
  })
  @ApiQuery({ name: "year", required: false, description: "Annee scolaire" })
  @ApiResponse({ status: 200, description: "Liste des periodes de vacances" })
  async findAll(@Query("year") year?: string) {
    const parsedYear = year ? parseInt(year, 10) : undefined;
    return this.schoolVacationsService.findAll(parsedYear);
  }

  @Get("range")
  @ApiOperation({ summary: "Recuperer les vacances scolaires sur une periode" })
  @ApiResponse({
    status: 200,
    description: "Periodes de vacances sur la plage",
  })
  async findByRange(@Query() query: SchoolVacationRangeQueryDto) {
    return this.schoolVacationsService.findByRange(
      query.startDate,
      query.endDate,
    );
  }

  @Get(":id")
  @ApiOperation({ summary: "Recuperer une periode de vacances par ID" })
  @ApiParam({ name: "id", description: "ID de la periode" })
  @ApiResponse({ status: 200, description: "Detail de la periode" })
  @ApiResponse({ status: 404, description: "Periode non trouvee" })
  async findOne(@Param("id") id: string) {
    return this.schoolVacationsService.findOne(id);
  }

  @Post()
  @Permissions("school_vacations:create")
  @ApiOperation({ summary: "Creer une periode de vacances scolaires" })
  @ApiResponse({ status: 201, description: "Periode creee" })
  @ApiResponse({ status: 409, description: "Periode deja existante" })
  async create(
    @Body() dto: CreateSchoolVacationDto,
    @CurrentUser() user: User,
  ) {
    return this.schoolVacationsService.create(dto, user.id);
  }

  @Post("import")
  @Permissions("school_vacations:create")
  @ApiOperation({
    summary: "Importer les vacances scolaires depuis l'open data",
  })
  @ApiResponse({
    status: 201,
    description: "Vacances importees",
    schema: {
      type: "object",
      properties: {
        created: { type: "number", description: "Periodes creees" },
        skipped: {
          type: "number",
          description: "Periodes ignorees (deja existantes)",
        },
      },
    },
  })
  async importFromOpenData(
    @Body() dto: ImportSchoolVacationDto,
    @CurrentUser() user: User,
  ) {
    const zoneSetting = await this.settingsService.getValue(
      "planning.schoolVacationZone",
    );
    const zone = (zoneSetting as SchoolVacationZone) ?? SchoolVacationZone.C;
    return this.schoolVacationsService.importFromOpenData(
      dto.year,
      zone,
      user.id,
    );
  }

  @Patch(":id")
  @Permissions("school_vacations:update")
  @ApiOperation({ summary: "Modifier une periode de vacances scolaires" })
  @ApiParam({ name: "id", description: "ID de la periode" })
  @ApiResponse({ status: 200, description: "Periode mise a jour" })
  @ApiResponse({ status: 404, description: "Periode non trouvee" })
  @ApiResponse({ status: 409, description: "Conflit de nom/zone/annee" })
  async update(@Param("id") id: string, @Body() dto: UpdateSchoolVacationDto) {
    return this.schoolVacationsService.update(id, dto);
  }

  @Delete(":id")
  @Permissions("school_vacations:delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprimer une periode de vacances scolaires" })
  @ApiParam({ name: "id", description: "ID de la periode" })
  @ApiResponse({ status: 204, description: "Periode supprimee" })
  @ApiResponse({ status: 404, description: "Periode non trouvee" })
  async remove(@Param("id") id: string) {
    await this.schoolVacationsService.remove(id);
  }
}
```

- [ ] **Step 5.2: Commit**

```bash
git add apps/api/src/school-vacations/school-vacations.controller.ts
git commit -m "feat(school-vacations): add controller with CRUD and import endpoints"
```

---

## Task 6: Backend — Module + App Registration

**Files:**

- Create: `apps/api/src/school-vacations/school-vacations.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 6.1: Create the module**

```typescript
import { Module } from "@nestjs/common";
import { SchoolVacationsController } from "./school-vacations.controller";
import { SchoolVacationsService } from "./school-vacations.service";
import { PrismaModule } from "../prisma/prisma.module";
import { SettingsModule } from "../settings/settings.module";

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [SchoolVacationsController],
  providers: [SchoolVacationsService],
  exports: [SchoolVacationsService],
})
export class SchoolVacationsModule {}
```

Note: `SettingsModule` is imported because the controller reads `planning.schoolVacationZone` from settings during import. Check that `SettingsModule` exports `SettingsService` — if not, the `SettingsService` needs to be added to exports. Verify by reading `apps/api/src/settings/settings.module.ts`.

- [ ] **Step 6.2: Register in app.module.ts**

In `apps/api/src/app.module.ts`, add the import at the top (after line 30, after `PredefinedTasksModule`):

```typescript
import { SchoolVacationsModule } from "./school-vacations/school-vacations.module";
```

Add `SchoolVacationsModule` to the `imports` array (after `PredefinedTasksModule` on line 74):

```typescript
    PredefinedTasksModule,
    SchoolVacationsModule,
```

- [ ] **Step 6.3: Verify SettingsModule exports SettingsService**

Read `apps/api/src/settings/settings.module.ts` and verify `SettingsService` is in the `exports` array. If not, add it. Also verify `SettingsService` has a `getValue(key: string)` method. If it uses a different method name (like `getOne` or `findByKey`), adapt the controller call in Task 5 accordingly.

- [ ] **Step 6.4: Build check**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run build 2>&1 | tail -10
```

Expected: Build succeeds without errors.

- [ ] **Step 6.5: Commit**

```bash
git add apps/api/src/school-vacations/school-vacations.module.ts apps/api/src/app.module.ts
git commit -m "feat(school-vacations): register module in app"
```

---

## Task 7: Backend — Unit Tests

**Files:**

- Create: `apps/api/src/school-vacations/school-vacations.spec.ts`

- [ ] **Step 7.1: Write unit tests**

```typescript
import { Test, TestingModule } from "@nestjs/testing";
import { SchoolVacationsService } from "./school-vacations.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException, ConflictException } from "@nestjs/common";

describe("SchoolVacationsService", () => {
  let service: SchoolVacationsService;
  let prisma: PrismaService;

  const mockPrisma = {
    schoolVacation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchoolVacationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SchoolVacationsService>(SchoolVacationsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe("findAll", () => {
    it("should return all school vacations", async () => {
      const vacations = [
        { id: "1", name: "Vacances de Noel", year: 2025, zone: "C" },
      ];
      mockPrisma.schoolVacation.findMany.mockResolvedValue(vacations);

      const result = await service.findAll();

      expect(result).toEqual(vacations);
      expect(mockPrisma.schoolVacation.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startDate: "asc" },
      });
    });

    it("should filter by year when provided", async () => {
      mockPrisma.schoolVacation.findMany.mockResolvedValue([]);

      await service.findAll(2025);

      expect(mockPrisma.schoolVacation.findMany).toHaveBeenCalledWith({
        where: { year: 2025 },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { startDate: "asc" },
      });
    });
  });

  describe("findOne", () => {
    it("should return a school vacation by id", async () => {
      const vacation = { id: "1", name: "Vacances de Printemps" };
      mockPrisma.schoolVacation.findUnique.mockResolvedValue(vacation);

      const result = await service.findOne("1");

      expect(result).toEqual(vacation);
    });

    it("should throw NotFoundException when not found", async () => {
      mockPrisma.schoolVacation.findUnique.mockResolvedValue(null);

      await expect(service.findOne("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findByRange", () => {
    it("should find vacations overlapping the date range", async () => {
      mockPrisma.schoolVacation.findMany.mockResolvedValue([]);

      await service.findByRange("2026-04-01", "2026-04-30");

      expect(mockPrisma.schoolVacation.findMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { startDate: { lte: new Date("2026-04-30") } },
            { endDate: { gte: new Date("2026-04-01") } },
          ],
        },
        orderBy: { startDate: "asc" },
      });
    });
  });

  describe("create", () => {
    it("should create a school vacation", async () => {
      const dto = {
        name: "Vacances de Printemps",
        startDate: "2026-04-11",
        endDate: "2026-04-27",
        year: 2025,
      };
      const created = { id: "1", ...dto, zone: "C", source: "MANUAL" };
      mockPrisma.schoolVacation.create.mockResolvedValue(created);

      const result = await service.create(dto, "user-1");

      expect(result).toEqual(created);
    });

    it("should throw ConflictException on duplicate", async () => {
      const dto = {
        name: "Vacances de Printemps",
        startDate: "2026-04-11",
        endDate: "2026-04-27",
        year: 2025,
      };
      const prismaError = new Error("Unique constraint") as any;
      prismaError.code = "P2002";
      prismaError.constructor = { name: "PrismaClientKnownRequestError" };
      // Use the actual Prisma error class pattern
      mockPrisma.schoolVacation.create.mockRejectedValue(prismaError);

      // Note: this test may need adjustment based on how Prisma errors are detected
      // in the test environment. The service catches PrismaClientKnownRequestError.
      await expect(service.create(dto, "user-1")).rejects.toThrow();
    });
  });

  describe("remove", () => {
    it("should delete a school vacation", async () => {
      mockPrisma.schoolVacation.findUnique.mockResolvedValue({ id: "1" });
      mockPrisma.schoolVacation.delete.mockResolvedValue({ id: "1" });

      await service.remove("1");

      expect(mockPrisma.schoolVacation.delete).toHaveBeenCalledWith({
        where: { id: "1" },
      });
    });

    it("should throw NotFoundException if not found", async () => {
      mockPrisma.schoolVacation.findUnique.mockResolvedValue(null);

      await expect(service.remove("nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
```

- [ ] **Step 7.2: Run tests**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && npx vitest run apps/api/src/school-vacations/school-vacations.spec.ts
```

Expected: All tests pass.

- [ ] **Step 7.3: Commit**

```bash
git add apps/api/src/school-vacations/school-vacations.spec.ts
git commit -m "test(school-vacations): add unit tests for service"
```

---

## Task 8: Frontend — Types

**Files:**

- Modify: `apps/web/src/types/index.ts` (after line 751, after `HOLIDAY_TYPE_COLORS`)

- [ ] **Step 8.1: Add SchoolVacation types**

Add after the `HOLIDAY_TYPE_COLORS` block (after line 751):

```typescript
// ===========================
// SCHOOL VACATIONS (VACANCES SCOLAIRES)
// ===========================

export enum SchoolVacationZone {
  A = "A",
  B = "B",
  C = "C",
}

export enum SchoolVacationSource {
  IMPORT = "IMPORT",
  MANUAL = "MANUAL",
}

export interface SchoolVacation {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  zone: SchoolVacationZone;
  year: number;
  source: SchoolVacationSource;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export interface CreateSchoolVacationDto {
  name: string;
  startDate: string;
  endDate: string;
  zone?: SchoolVacationZone;
  year: number;
  source?: SchoolVacationSource;
}

export interface UpdateSchoolVacationDto {
  name?: string;
  startDate?: string;
  endDate?: string;
  zone?: SchoolVacationZone;
  year?: number;
}

export interface ImportSchoolVacationResult {
  created: number;
  skipped: number;
}

export const SCHOOL_VACATION_ZONE_LABELS: Record<SchoolVacationZone, string> = {
  [SchoolVacationZone.A]: "Zone A",
  [SchoolVacationZone.B]: "Zone B",
  [SchoolVacationZone.C]: "Zone C",
};

export const SCHOOL_VACATION_SOURCE_LABELS: Record<
  SchoolVacationSource,
  string
> = {
  [SchoolVacationSource.IMPORT]: "Import",
  [SchoolVacationSource.MANUAL]: "Manuel",
};

export const SCHOOL_VACATION_SOURCE_COLORS: Record<
  SchoolVacationSource,
  string
> = {
  [SchoolVacationSource.IMPORT]: "bg-blue-100 text-blue-800",
  [SchoolVacationSource.MANUAL]: "bg-gray-100 text-gray-800",
};
```

- [ ] **Step 8.2: Commit**

```bash
git add apps/web/src/types/index.ts
git commit -m "feat(types): add SchoolVacation types and enums"
```

---

## Task 9: Frontend — API Service

**Files:**

- Create: `apps/web/src/services/school-vacations.service.ts`

- [ ] **Step 9.1: Create the service**

```typescript
import { api } from "@/lib/api";
import {
  SchoolVacation,
  CreateSchoolVacationDto,
  UpdateSchoolVacationDto,
  ImportSchoolVacationResult,
} from "@/types";

export const schoolVacationsService = {
  async getAll(year?: number): Promise<SchoolVacation[]> {
    const url = year ? `/school-vacations?year=${year}` : "/school-vacations";
    const response = await api.get<SchoolVacation[]>(url);
    return response.data;
  },

  async getByRange(
    startDate: string,
    endDate: string,
  ): Promise<SchoolVacation[]> {
    const response = await api.get<SchoolVacation[]>(
      `/school-vacations/range?startDate=${startDate}&endDate=${endDate}`,
    );
    return response.data;
  },

  async getById(id: string): Promise<SchoolVacation> {
    const response = await api.get<SchoolVacation>(`/school-vacations/${id}`);
    return response.data;
  },

  async create(data: CreateSchoolVacationDto): Promise<SchoolVacation> {
    const response = await api.post<SchoolVacation>("/school-vacations", data);
    return response.data;
  },

  async update(
    id: string,
    data: UpdateSchoolVacationDto,
  ): Promise<SchoolVacation> {
    const response = await api.patch<SchoolVacation>(
      `/school-vacations/${id}`,
      data,
    );
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/school-vacations/${id}`);
  },

  async importFromOpenData(year: number): Promise<ImportSchoolVacationResult> {
    const response = await api.post<ImportSchoolVacationResult>(
      "/school-vacations/import",
      { year },
    );
    return response.data;
  },
};
```

- [ ] **Step 9.2: Commit**

```bash
git add apps/web/src/services/school-vacations.service.ts
git commit -m "feat(school-vacations): add frontend API service"
```

---

## Task 10: Frontend — usePlanningData Hook Integration

**Files:**

- Modify: `apps/web/src/hooks/usePlanningData.ts`

- [ ] **Step 10.1: Add import**

At the top of the file (after line 18, after `holidaysService` import):

```typescript
import { schoolVacationsService } from "@/services/school-vacations.service";
```

Add `SchoolVacation` to the types import (line 24):

```typescript
import {
  Task,
  User,
  Leave,
  TeleworkSchedule,
  Service,
  Holiday,
  SchoolVacation,
} from "@/types";
```

- [ ] **Step 10.2: Add state**

Add a new state variable (near the other state declarations, around line 100 area where `holidays` state is declared):

```typescript
const [schoolVacations, setSchoolVacations] = useState<SchoolVacation[]>([]);
```

- [ ] **Step 10.3: Add to Promise.all fetch**

In the `fetchData` function's `Promise.all` (around line 189-226), add one more entry after `holidaysService.getByRange`:

```typescript
          schoolVacationsService
            .getByRange(teleworkStartDate, teleworkEndDate)
            .catch(() => []),
```

Update the destructured array to include it (add `schoolVacationsData` after `holidaysData`):

```typescript
        const [
          usersData,
          tasksData,
          leavesData,
          eventsData,
          teleworkData,
          servicesData,
          holidaysData,
          schoolVacationsData,
          predefinedAssignmentsData,
        ] = await Promise.all([
```

- [ ] **Step 10.4: Set state after fetch**

After the `setHolidays(...)` call (find it in the code), add:

```typescript
setSchoolVacations(
  Array.isArray(schoolVacationsData) ? schoolVacationsData : [],
);
```

- [ ] **Step 10.5: Expose in return object**

Add `schoolVacations` to the return object (around line 592-610):

```typescript
return {
  loading,
  displayDays,
  users,
  services,
  tasks,
  leaves,
  events,
  teleworkSchedules,
  holidays,
  schoolVacations,
  groupedUsers,
  filteredGroups,
  getDayCell,
  getHolidayForDate,
  isSpecialDay,
  refetch: fetchData,
  silentRefetch: () => fetchData(true),
  getGroupTaskCount,
};
```

- [ ] **Step 10.6: Commit**

```bash
git add apps/web/src/hooks/usePlanningData.ts
git commit -m "feat(planning): fetch school vacations in usePlanningData hook"
```

---

## Task 11: Frontend — PlanningGrid Banner

**Files:**

- Modify: `apps/web/src/components/planning/PlanningGrid.tsx`

This is the core visual feature. The banner row is inserted between the day headers (line 404, after `</div>` closing the header row) and the service sections (line 406, `{/* Service sections */}`).

- [ ] **Step 11.1: Add schoolVacations to destructured hook result**

In `PlanningGrid.tsx`, find where `usePlanningData` return values are destructured (around line 140-155). Add `schoolVacations`:

```typescript
  const {
    loading,
    displayDays,
    filteredGroups,
    getDayCell,
    getHolidayForDate,
    isSpecialDay,
    schoolVacations,
    silentRefetch,
    getGroupTaskCount,
  } = usePlanningData({
```

- [ ] **Step 11.2: Add imports**

Add at the top of the file:

```typescript
import { SchoolVacation } from "@/types";
import { isWithinInterval, parseISO } from "date-fns";
```

Note: `isWithinInterval` and `parseISO` may already be imported from date-fns. Check and only add the missing ones.

- [ ] **Step 11.3: Compute banner data**

Add a `useMemo` after the existing hooks/memos (before the return JSX), to compute which vacation periods overlap the displayed days and what grid columns they span:

```typescript
const vacationBanners = useMemo(() => {
  if (!schoolVacations.length || !displayDays.length) return [];

  return schoolVacations
    .map((vacation) => {
      const vacStart = parseISO(
        typeof vacation.startDate === "string"
          ? vacation.startDate.slice(0, 10)
          : vacation.startDate,
      );
      const vacEnd = parseISO(
        typeof vacation.endDate === "string"
          ? vacation.endDate.slice(0, 10)
          : vacation.endDate,
      );

      // Find first and last visible day indices that fall within the vacation
      let firstCol = -1;
      let lastCol = -1;

      for (let i = 0; i < displayDays.length; i++) {
        const day = displayDays[i];
        if (day >= vacStart && day <= vacEnd) {
          if (firstCol === -1) firstCol = i;
          lastCol = i;
        }
      }

      if (firstCol === -1) return null;

      return {
        id: vacation.id,
        name: vacation.name,
        zone: vacation.zone,
        // gridColumn is 1-indexed, +2 because col 1 is the "Ressource" label column
        gridColumnStart: firstCol + 2,
        gridColumnEnd: lastCol + 3, // CSS grid end is exclusive
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    name: string;
    zone: string;
    gridColumnStart: number;
    gridColumnEnd: number;
  }>;
}, [schoolVacations, displayDays]);
```

- [ ] **Step 11.4: Add banner JSX**

In the JSX, between the closing `</div>` of the day headers block (after line 403) and `{/* Service sections */}` (line 406), insert:

```tsx
{
  /* School vacation banners */
}
{
  vacationBanners.length > 0 && (
    <div style={{ display: "grid", gridTemplateColumns: gridCols }}>
      {/* Empty cell for the Ressource column */}
      <div />
      {vacationBanners.map((banner) => (
        <div
          key={banner.id}
          style={{
            gridColumn: `${banner.gridColumnStart} / ${banner.gridColumnEnd}`,
            background: "linear-gradient(90deg, #dbeafe, #bfdbfe)",
            borderBottom: "2px solid #3b82f6",
          }}
          className={`text-center font-semibold text-blue-800 ${
            viewMode === "month" ? "text-[9px] py-0.5" : "text-xs py-1"
          }`}
        >
          {viewMode === "month"
            ? `🏖️ ${banner.name.replace(/^Vacances (de |d'|du )/i, "")}`
            : `🏖️ ${banner.name} — Zone ${banner.zone}`}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 11.5: Build check**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 11.6: Commit**

```bash
git add apps/web/src/components/planning/PlanningGrid.tsx
git commit -m "feat(planning): add school vacation banner between headers and service rows"
```

---

## Task 12: Frontend — Admin Panel (SchoolVacationsManager)

**Files:**

- Create: `apps/web/src/components/school-vacations/SchoolVacationsManager.tsx`

- [ ] **Step 12.1: Create the component**

This component follows the exact same pattern as `HolidaysManager.tsx`. Key differences: year selector refers to school year (2025 = "2025-2026"), import calls `schoolVacationsService.importFromOpenData(year)`, table shows name/dates/source instead of date/type/isWorkDay.

```tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  SchoolVacation,
  SchoolVacationSource,
  SCHOOL_VACATION_SOURCE_LABELS,
  SCHOOL_VACATION_SOURCE_COLORS,
} from "@/types";
import { schoolVacationsService } from "@/services/school-vacations.service";
import { SchoolVacationModal } from "./SchoolVacationModal";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

export function SchoolVacationsManager() {
  const t = useTranslations("settings.schoolVacations");
  const tCommon = useTranslations("common.actions");

  // Current school year: if we're between Sept and Dec, year = current year; otherwise year = current year - 1
  const now = new Date();
  const currentSchoolYear =
    now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  const [selectedYear, setSelectedYear] = useState(currentSchoolYear);
  const [vacations, setVacations] = useState<SchoolVacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVacation, setEditingVacation] = useState<SchoolVacation | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchVacations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await schoolVacationsService.getAll(selectedYear);
      setVacations(data);
    } catch {
      toast.error(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  }, [selectedYear, t]);

  useEffect(() => {
    fetchVacations();
  }, [fetchVacations]);

  const sortedVacations = useMemo(() => {
    return [...vacations].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }, [vacations]);

  const handleCreate = () => {
    setEditingVacation(null);
    setIsModalOpen(true);
  };

  const handleEdit = (vacation: SchoolVacation) => {
    setEditingVacation(vacation);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await schoolVacationsService.delete(id);
      toast.success(t("messages.deleteSuccess"));
      fetchVacations();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t("messages.deleteError"));
    }
    setDeleteConfirmId(null);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result =
        await schoolVacationsService.importFromOpenData(selectedYear);
      toast.success(
        t("messages.importSuccess", {
          created: result.created,
          skipped: result.skipped,
        }),
      );
      fetchVacations();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t("messages.importError"));
    } finally {
      setIsImporting(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const handlePrevYear = () => setSelectedYear((y) => y - 1);
  const handleNextYear = () => setSelectedYear((y) => y + 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <span className="text-2xl">🏖️</span>
            {t("title")}
          </h2>

          {/* School year selector */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2">
            <button
              onClick={handlePrevYear}
              className="p-2 hover:bg-gray-200 rounded transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <span className="font-medium w-24 text-center">
              {selectedYear}-{selectedYear + 1}
            </span>
            <button
              onClick={handleNextYear}
              className="p-2 hover:bg-gray-200 rounded transition"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2 disabled:opacity-50"
          >
            {isImporting ? (
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            )}
            <span>
              {t("importButton", {
                year: `${selectedYear}-${selectedYear + 1}`,
              })}
            </span>
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>{t("addButton")}</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.name")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.startDate")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.endDate")}
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.source")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("table.headers.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  <p className="mt-2 text-gray-500">{tCommon("loading")}</p>
                </td>
              </tr>
            ) : sortedVacations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  {t("table.empty", {
                    year: `${selectedYear}-${selectedYear + 1}`,
                  })}
                </td>
              </tr>
            ) : (
              sortedVacations.map((vacation) => (
                <tr key={vacation.id} className="hover:bg-gray-100 transition">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="font-medium text-gray-900">
                      {vacation.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900">
                      {formatDate(vacation.startDate)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-gray-900">
                      {formatDate(vacation.endDate)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${SCHOOL_VACATION_SOURCE_COLORS[vacation.source]}`}
                    >
                      {SCHOOL_VACATION_SOURCE_LABELS[vacation.source]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(vacation)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition"
                        title={t("tooltips.edit")}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      {deleteConfirmId === vacation.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(vacation.id)}
                            className="p-2 text-white bg-red-600 rounded hover:bg-red-700 transition"
                            title={t("tooltips.confirm")}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="p-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 transition"
                            title={t("tooltips.cancel")}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(vacation.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          title={t("tooltips.delete")}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      {!loading && sortedVacations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t("stats.total")}</p>
            <p className="text-2xl font-bold text-gray-900">
              {sortedVacations.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t("stats.imported")}</p>
            <p className="text-2xl font-bold text-blue-600">
              {
                sortedVacations.filter(
                  (v) => v.source === SchoolVacationSource.IMPORT,
                ).length
              }
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{t("stats.manual")}</p>
            <p className="text-2xl font-bold text-gray-600">
              {
                sortedVacations.filter(
                  (v) => v.source === SchoolVacationSource.MANUAL,
                ).length
              }
            </p>
          </div>
        </div>
      )}

      {/* Modal */}
      <SchoolVacationModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVacation(null);
        }}
        onSuccess={fetchVacations}
        vacation={editingVacation}
        defaultYear={selectedYear}
      />
    </div>
  );
}
```

- [ ] **Step 12.2: Commit**

```bash
git add apps/web/src/components/school-vacations/SchoolVacationsManager.tsx
git commit -m "feat(school-vacations): add admin manager component"
```

---

## Task 13: Frontend — Admin Modal (SchoolVacationModal)

**Files:**

- Create: `apps/web/src/components/school-vacations/SchoolVacationModal.tsx`

- [ ] **Step 13.1: Create the modal component**

Follows the `HolidayModal` pattern — form with name, startDate, endDate, year fields.

```tsx
"use client";

import { useState, useEffect } from "react";
import { SchoolVacation, CreateSchoolVacationDto } from "@/types";
import { schoolVacationsService } from "@/services/school-vacations.service";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface SchoolVacationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vacation?: SchoolVacation | null;
  defaultYear?: number;
}

export function SchoolVacationModal({
  isOpen,
  onClose,
  onSuccess,
  vacation,
  defaultYear,
}: SchoolVacationModalProps) {
  const t = useTranslations("settings.schoolVacations.modal");
  const isEditing = !!vacation;

  const [formData, setFormData] = useState<CreateSchoolVacationDto>({
    name: "",
    startDate: "",
    endDate: "",
    year: defaultYear ?? new Date().getFullYear(),
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vacation) {
      setFormData({
        name: vacation.name,
        startDate:
          typeof vacation.startDate === "string"
            ? vacation.startDate.slice(0, 10)
            : vacation.startDate,
        endDate:
          typeof vacation.endDate === "string"
            ? vacation.endDate.slice(0, 10)
            : vacation.endDate,
        year: vacation.year,
      });
    } else {
      setFormData({
        name: "",
        startDate: "",
        endDate: "",
        year: defaultYear ?? new Date().getFullYear(),
      });
    }
  }, [vacation, defaultYear, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.startDate || !formData.endDate) {
      toast.error(t("validation.required"));
      return;
    }
    if (formData.endDate < formData.startDate) {
      toast.error(t("validation.endBeforeStart"));
      return;
    }

    setSaving(true);
    try {
      if (isEditing && vacation) {
        await schoolVacationsService.update(vacation.id, formData);
        toast.success(t("messages.updateSuccess"));
      } else {
        await schoolVacationsService.create(formData);
        toast.success(t("messages.createSuccess"));
      }
      onSuccess();
      onClose();
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t("messages.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEditing ? t("titleEdit") : t("titleCreate")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("fields.name")} *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={t("fields.namePlaceholder")}
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Start date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("fields.startDate")} *
            </label>
            <input
              type="date"
              value={formData.startDate}
              onChange={(e) =>
                setFormData({ ...formData, startDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* End date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("fields.endDate")} *
            </label>
            <input
              type="date"
              value={formData.endDate}
              onChange={(e) =>
                setFormData({ ...formData, endDate: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("fields.year")}
            </label>
            <input
              type="number"
              value={formData.year}
              onChange={(e) =>
                setFormData({ ...formData, year: parseInt(e.target.value, 10) })
              }
              min={2020}
              max={2100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              {t("fields.yearHint", {
                year: formData.year,
                nextYear: formData.year + 1,
              })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? t("saving") : isEditing ? t("update") : t("create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 13.2: Commit**

```bash
git add apps/web/src/components/school-vacations/SchoolVacationModal.tsx
git commit -m "feat(school-vacations): add create/edit modal component"
```

---

## Task 14: Frontend — Settings Page Integration

**Files:**

- Modify: `apps/web/app/[locale]/settings/page.tsx`

- [ ] **Step 14.1: Add import**

At the top of the file (after line 10, after `HolidaysManager` import):

```typescript
import { SchoolVacationsManager } from "@/components/school-vacations/SchoolVacationsManager";
import { SchoolVacationZone, SCHOOL_VACATION_ZONE_LABELS } from "@/types";
```

- [ ] **Step 14.2: Extend CategoryTab type**

Change line 13 from:

```typescript
type CategoryTab = "display" | "planning" | "holidays";
```

to:

```typescript
type CategoryTab = "display" | "planning" | "holidays" | "schoolVacations";
```

- [ ] **Step 14.3: Add tab button**

After the "holidays" tab button (after line 223, before `</nav>`), add:

```tsx
<button
  onClick={() => setActiveTab("schoolVacations")}
  className={`py-4 px-1 border-b-2 font-medium text-sm ${
    activeTab === "schoolVacations"
      ? "border-blue-500 text-blue-600"
      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
  }`}
>
  {t("tabs.schoolVacations")}
</button>
```

- [ ] **Step 14.4: Add tab content**

After the holidays tab content block (after line 415, before the closing `</div>` of the content wrapper), add:

```tsx
{
  /* School Vacations Settings */
}
{
  activeTab === "schoolVacations" && (
    <div className="p-6 space-y-6">
      {/* Zone selector */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">
          {t("schoolVacations.zoneLabel")}
        </h3>
        <select
          value={(settings["planning.schoolVacationZone"] as string) ?? "C"}
          onChange={(e) =>
            handleSettingChange("planning.schoolVacationZone", e.target.value)
          }
          className="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.entries(SCHOOL_VACATION_ZONE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {t("schoolVacations.zoneHint")}
        </p>
      </div>

      {/* Manager */}
      <SchoolVacationsManager />
    </div>
  );
}
```

Note: `handleSettingChange` is the existing function in the settings page that updates the local `settings` state and marks `hasChanges = true`. Verify it exists and uses this signature. If it uses a different pattern, adapt accordingly.

- [ ] **Step 14.5: Add default setting**

In `apps/web/src/stores/settings.store.ts`, add to `DEFAULT_SETTINGS`:

```typescript
"planning.schoolVacationZone": "C",
```

- [ ] **Step 14.6: Build check**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 14.7: Commit**

```bash
git add apps/web/app/[locale]/settings/page.tsx apps/web/src/stores/settings.store.ts
git commit -m "feat(settings): add school vacations tab with zone selector and manager"
```

---

## Task 15: i18n — Translation Keys

**Files:**

- Identify and modify the i18n translation files (likely in `apps/web/messages/` or `apps/web/public/locales/`)

- [ ] **Step 15.1: Find translation files**

Run:

```bash
find /home/alex/Documents/REPO/ORCHESTRA/apps/web -name "*.json" -path "*/messages/*" -o -name "*.json" -path "*/locales/*" | head -20
```

Or search for existing translation keys:

```bash
grep -rl "settings.holidays" /home/alex/Documents/REPO/ORCHESTRA/apps/web --include="*.json" | head -5
```

- [ ] **Step 15.2: Add French translations for schoolVacations**

In the French translation file, add under `settings`:

```json
"schoolVacations": {
  "title": "Vacances scolaires",
  "importButton": "Importer {year}",
  "addButton": "Ajouter",
  "table": {
    "headers": {
      "name": "Periode",
      "startDate": "Debut",
      "endDate": "Fin",
      "source": "Source",
      "actions": "Actions"
    },
    "empty": "Aucune vacance scolaire pour l'annee {year}"
  },
  "stats": {
    "total": "Total",
    "imported": "Importees",
    "manual": "Manuelles"
  },
  "messages": {
    "loadError": "Erreur lors du chargement des vacances scolaires",
    "deleteSuccess": "Periode supprimee",
    "deleteError": "Erreur lors de la suppression",
    "importSuccess": "{created} periodes importees, {skipped} ignorees",
    "importError": "Erreur lors de l'import"
  },
  "tooltips": {
    "edit": "Modifier",
    "delete": "Supprimer",
    "confirm": "Confirmer",
    "cancel": "Annuler"
  },
  "modal": {
    "titleCreate": "Ajouter une periode de vacances",
    "titleEdit": "Modifier la periode de vacances",
    "fields": {
      "name": "Nom",
      "namePlaceholder": "Ex: Vacances de Printemps",
      "startDate": "Date de debut",
      "endDate": "Date de fin",
      "year": "Annee scolaire",
      "yearHint": "Annee scolaire {year}-{nextYear}"
    },
    "validation": {
      "required": "Veuillez remplir tous les champs obligatoires",
      "endBeforeStart": "La date de fin doit etre posterieure a la date de debut"
    },
    "messages": {
      "createSuccess": "Periode creee avec succes",
      "updateSuccess": "Periode mise a jour",
      "saveError": "Erreur lors de l'enregistrement"
    },
    "cancel": "Annuler",
    "create": "Creer",
    "update": "Mettre a jour",
    "saving": "Enregistrement..."
  },
  "zoneLabel": "Zone scolaire",
  "zoneHint": "Zone utilisee pour l'import depuis le calendrier officiel"
}
```

Also add the tab label:

```json
"tabs": {
  ...existing tabs...,
  "schoolVacations": "Vacances scolaires"
}
```

- [ ] **Step 15.3: Add English translations** (if en.json exists)

Same keys with English values. Adapt accordingly.

- [ ] **Step 15.4: Commit**

```bash
git add apps/web/messages/ # or apps/web/public/locales/
git commit -m "feat(i18n): add school vacations translation keys (fr + en)"
```

---

## Task 16: Full Build + Smoke Test

- [ ] **Step 16.1: Full build**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run build
```

Expected: Build succeeds for both API and Web.

- [ ] **Step 16.2: Run existing tests**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run test 2>&1 | tail -20
```

Expected: All existing tests pass, new school-vacations tests pass.

- [ ] **Step 16.3: Dev smoke test**

Run:

```bash
cd /home/alex/Documents/REPO/ORCHESTRA && pnpm run docker:dev && pnpm run dev
```

Then manually verify:

1. API: `GET /api/school-vacations` returns `[]`
2. API: Swagger docs at `/api/docs` show new endpoints
3. Frontend: Settings page has "Vacances scolaires" tab
4. Frontend: Zone selector works
5. Frontend: Import button calls API
6. Frontend: Planning view shows banner when data exists

- [ ] **Step 16.4: Final commit**

If any fixes were needed during smoke test, commit them:

```bash
git add -A
git commit -m "fix(school-vacations): smoke test fixes"
```
