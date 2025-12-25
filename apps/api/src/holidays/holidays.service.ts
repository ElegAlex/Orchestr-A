import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holiday, HolidayType, Prisma } from 'database';

@Injectable()
export class HolidaysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère tous les jours fériés
   */
  async findAll(): Promise<Holiday[]> {
    return this.prisma.holiday.findMany({
      orderBy: { date: 'asc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Récupère un jour férié par ID
   */
  async findOne(id: string): Promise<Holiday> {
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!holiday) {
      throw new NotFoundException(`Jour férié avec l'ID "${id}" non trouvé`);
    }

    return holiday;
  }

  /**
   * Récupère les jours fériés d'une année donnée
   */
  async findByYear(year: number): Promise<Holiday[]> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      orderBy: { date: 'asc' },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Récupère les jours fériés sur une période donnée
   */
  async findByRange(startDate: string, endDate: string): Promise<Holiday[]> {
    return this.prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  /**
   * Crée un nouveau jour férié
   */
  async create(dto: CreateHolidayDto, userId: string): Promise<Holiday> {
    const holidayDate = new Date(dto.date);

    // Vérifier si un jour férié existe déjà à cette date
    const existingHoliday = await this.prisma.holiday.findUnique({
      where: { date: holidayDate },
    });

    if (existingHoliday) {
      throw new ConflictException(
        `Un jour férié existe déjà pour la date ${dto.date}`,
      );
    }

    return this.prisma.holiday.create({
      data: {
        date: holidayDate,
        name: dto.name,
        type: dto.type || HolidayType.LEGAL,
        isWorkDay: dto.isWorkDay ?? false,
        description: dto.description,
        recurring: dto.recurring ?? false,
        createdById: userId,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  /**
   * Met à jour un jour férié
   */
  async update(id: string, dto: UpdateHolidayDto): Promise<Holiday> {
    await this.findOne(id); // Vérifie que le jour férié existe

    const updateData: Prisma.HolidayUpdateInput = {};

    if (dto.date !== undefined) {
      const newDate = new Date(dto.date);
      // Vérifier qu'aucun autre jour férié n'existe à cette date
      const existingAtDate = await this.prisma.holiday.findFirst({
        where: {
          date: newDate,
          id: { not: id },
        },
      });
      if (existingAtDate) {
        throw new ConflictException(
          `Un jour férié existe déjà pour la date ${dto.date}`,
        );
      }
      updateData.date = newDate;
    }
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.type !== undefined) updateData.type = dto.type;
    if (dto.isWorkDay !== undefined) updateData.isWorkDay = dto.isWorkDay;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.recurring !== undefined) updateData.recurring = dto.recurring;

    return this.prisma.holiday.update({
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
   * Supprime un jour férié
   */
  async remove(id: string): Promise<void> {
    await this.findOne(id); // Vérifie que le jour férié existe
    await this.prisma.holiday.delete({ where: { id } });
  }

  /**
   * Calcule la date de Pâques pour une année donnée (algorithme de Butcher-Meeus)
   */
  private calculateEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed month
    const day = ((h + l - 7 * m + 114) % 31) + 1;

    return new Date(year, month, day);
  }

  /**
   * Ajoute des jours à une date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  /**
   * Importe les jours fériés légaux français pour une année donnée
   */
  async importFrenchHolidays(
    year: number,
    userId: string,
  ): Promise<{ created: number; skipped: number }> {
    const easter = this.calculateEaster(year);

    const frenchHolidays: Array<{
      name: string;
      date: Date;
      type: HolidayType;
    }> = [
      // Jours fériés à date fixe
      {
        name: "Jour de l'An",
        date: new Date(year, 0, 1),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Fête du Travail',
        date: new Date(year, 4, 1),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Victoire 1945',
        date: new Date(year, 4, 8),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Fête Nationale',
        date: new Date(year, 6, 14),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Assomption',
        date: new Date(year, 7, 15),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Toussaint',
        date: new Date(year, 10, 1),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Armistice 1918',
        date: new Date(year, 10, 11),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Noël',
        date: new Date(year, 11, 25),
        type: HolidayType.LEGAL,
      },
      // Jours fériés mobiles basés sur Pâques
      {
        name: 'Lundi de Pâques',
        date: this.addDays(easter, 1),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Ascension',
        date: this.addDays(easter, 39),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Lundi de Pentecôte',
        date: this.addDays(easter, 50),
        type: HolidayType.LEGAL,
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const holiday of frenchHolidays) {
      try {
        await this.prisma.holiday.create({
          data: {
            date: holiday.date,
            name: holiday.name,
            type: holiday.type,
            isWorkDay: false,
            recurring: false,
            createdById: userId,
          },
        });
        created++;
      } catch (error) {
        // Si le jour férié existe déjà (contrainte unique sur date), on l'ignore
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

    return { created, skipped };
  }

  /**
   * Vérifie si une date est un jour férié non ouvré
   */
  async isNonWorkingHoliday(date: Date): Promise<boolean> {
    const holiday = await this.prisma.holiday.findUnique({
      where: { date },
    });

    return holiday !== null && !holiday.isWorkDay;
  }

  /**
   * Compte le nombre de jours ouvrés entre deux dates
   * (exclut les weekends et les jours fériés non ouvrés)
   */
  async countWorkingDays(startDate: Date, endDate: Date): Promise<number> {
    const holidays = await this.findByRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0],
    );

    const nonWorkingHolidayDates = new Set(
      holidays
        .filter((h) => !h.isWorkDay)
        .map((h) => new Date(h.date).toISOString().split('T')[0]),
    );

    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      // Exclut samedi (6) et dimanche (0) et jours fériés non ouvrés
      if (
        dayOfWeek !== 0 &&
        dayOfWeek !== 6 &&
        !nonWorkingHolidayDates.has(dateStr)
      ) {
        count++;
      }

      current.setDate(current.getDate() + 1);
    }

    return count;
  }
}
