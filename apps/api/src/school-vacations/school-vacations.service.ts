import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSchoolVacationDto } from './dto/create-school-vacation.dto';
import { UpdateSchoolVacationDto } from './dto/update-school-vacation.dto';
import { Prisma, SchoolVacationZone, SchoolVacationSource } from 'database';

interface OpenDataRecord {
  description: string;
  start_date: string;
  end_date: string;
  zones: string;
  annee_scolaire: string;
  location: string;
  population: string;
}

interface OpenDataResponse {
  total_count: number;
  results: OpenDataRecord[];
}

@Injectable()
export class SchoolVacationsService {
  private readonly logger = new Logger(SchoolVacationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère toutes les vacances scolaires, optionnellement filtrées par année
   */
  async findAll(year?: number) {
    return this.prisma.schoolVacation.findMany({
      where: year ? { year } : undefined,
      orderBy: { startDate: 'asc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Récupère une vacation scolaire par ID
   */
  async findOne(id: string) {
    const vacation = await this.prisma.schoolVacation.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!vacation) {
      throw new NotFoundException(
        `Vacances scolaires avec l'ID "${id}" non trouvées`,
      );
    }

    return vacation;
  }

  /**
   * Récupère les vacances scolaires sur une période donnée (chevauchement)
   */
  async findByRange(startDate: string, endDate: string) {
    return this.prisma.schoolVacation.findMany({
      where: {
        startDate: { lte: new Date(endDate) },
        endDate: { gte: new Date(startDate) },
      },
      orderBy: { startDate: 'asc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Crée de nouvelles vacances scolaires
   */
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
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Des vacances scolaires avec ce nom, cette zone et cette année existent déjà`,
        );
      }
      throw error;
    }
  }

  /**
   * Met à jour des vacances scolaires
   */
  async update(id: string, dto: UpdateSchoolVacationDto) {
    await this.findOne(id); // Vérifie que les vacances existent

    const updateData: Prisma.SchoolVacationUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.startDate !== undefined)
      updateData.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);
    if (dto.zone !== undefined) updateData.zone = dto.zone;
    if (dto.year !== undefined) updateData.year = dto.year;
    if (dto.source !== undefined) updateData.source = dto.source;

    return this.prisma.schoolVacation.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Supprime des vacances scolaires
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id); // Vérifie que les vacances existent
    await this.prisma.schoolVacation.delete({ where: { id } });
  }

  /**
   * Importe les vacances scolaires depuis l'API Open Data Éducation Nationale
   */
  async importFromOpenData(
    year: number,
    zone: SchoolVacationZone,
    userId: string,
  ): Promise<{ created: number; skipped: number }> {
    const zoneLabel = `Zone ${zone}`;
    const anneeScolaire = `${year}-${year + 1}`;
    const url = `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records`;
    const params = new URLSearchParams({
      where: `zones="${zoneLabel}" AND annee_scolaire="${anneeScolaire}"`,
      limit: '50',
    });

    this.logger.log(
      `Importing school vacations for zone ${zone}, year ${anneeScolaire}`,
    );

    const response = await fetch(`${url}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(
        `Open Data API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OpenDataResponse;
    this.logger.log(
      `Fetched ${data.total_count} records from Open Data API`,
    );

    // Dédupliquer par description, en prenant la plage de dates la plus large
    const vacationMap = new Map<
      string,
      { startDate: Date; endDate: Date }
    >();

    for (const record of data.results) {
      const key = record.description;
      const start = new Date(record.start_date);
      const end = new Date(record.end_date);

      if (!vacationMap.has(key)) {
        vacationMap.set(key, { startDate: start, endDate: end });
      } else {
        const existing = vacationMap.get(key)!;
        if (start < existing.startDate) existing.startDate = start;
        if (end > existing.endDate) existing.endDate = end;
      }
    }

    let created = 0;
    let skipped = 0;

    for (const [description, { startDate, endDate }] of vacationMap) {
      try {
        await this.prisma.schoolVacation.create({
          data: {
            name: description,
            startDate,
            endDate,
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
          error.code === 'P2002'
        ) {
          skipped++;
        } else {
          throw error;
        }
      }
    }

    this.logger.log(
      `Import complete: ${created} created, ${skipped} skipped`,
    );
    return { created, skipped };
  }
}
