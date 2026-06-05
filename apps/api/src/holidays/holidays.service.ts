import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import { Holiday, HolidayType, Prisma } from 'database';

@Injectable()
export class HolidaysService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HolidaysService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- DAT-031: Durable bootstrap + year-boundary cron ---

  /**
   * On every API boot, idempotently ensures holidays exist for currentYear and
   * currentYear+1. Safe to run on every restart thanks to @@unique([date])
   * (P2002 collisions are silently skipped in importFrenchHolidays).
   *
   * Finds the first ADMIN user to satisfy the non-nullable createdById FK.
   * If no admin user exists (empty DB before first seed), the import is
   * deferred to the next boot or to the manual admin endpoint — the guarantee
   * is best-effort bootstrap, not hard invariant on a pristine DB.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.autoImportHolidaysOnBoot();
    } catch (err) {
      this.logger.error(
        `Holiday bootstrap import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Core logic extracted for testability.
   * Exported as public so the spec can spy on importFrenchHolidays calls.
   */
  async autoImportHolidaysOnBoot(): Promise<void> {
    const adminUser = await this.prisma.user.findFirst({
      where: { role: { templateKey: 'ADMIN' } },
      select: { id: true },
    });

    if (!adminUser) {
      this.logger.warn(
        'Holiday bootstrap skipped: no ADMIN user found. Run the admin import endpoint after first seed.',
      );
      return;
    }

    const currentYear = new Date().getFullYear();
    for (const year of [currentYear, currentYear + 1]) {
      const { created, skipped } = await this.importFrenchHolidays(
        year,
        adminUser.id,
      );
      this.logger.log(
        `Holiday bootstrap ${year}: created=${created} skipped=${skipped}`,
      );
    }
  }

  /**
   * DAT-031: Year-boundary cron — fires on 1 December each year and imports
   * the upcoming year (currentYear+1) and the year after (currentYear+2),
   * keeping a rolling 2-year forward window populated automatically.
   *
   * Idempotent: P2002 collisions (already-existing rows) are skipped silently.
   * Timezone Europe/Paris ensures the cron fires on 1 Dec French time.
   */
  @Cron('0 2 1 12 *', { timeZone: 'Europe/Paris' })
  async autoImportHolidaysYearBoundary(): Promise<void> {
    try {
      const adminUser = await this.prisma.user.findFirst({
        where: { role: { templateKey: 'ADMIN' } },
        select: { id: true },
      });

      if (!adminUser) {
        this.logger.warn(
          'Year-boundary holiday cron skipped: no ADMIN user found.',
        );
        return;
      }

      const currentYear = new Date().getFullYear();
      for (const year of [currentYear + 1, currentYear + 2]) {
        const { created, skipped } = await this.importFrenchHolidays(
          year,
          adminUser.id,
        );
        this.logger.log(
          `Holiday year-boundary cron ${year}: created=${created} skipped=${skipped}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Year-boundary holiday cron failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- End DAT-031 ---

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
    // Use Date.UTC so the year boundary is correct on any host timezone.
    // @db.Date stores/matches by UTC date components; a local-midnight Date
    // on a +UTC host (e.g. Europe/Paris) shifts the boundary to Dec-31.
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const endOfYear = new Date(Date.UTC(year, 11, 31));

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

    // UTC midnight: the `date` column is `@db.Date`, which Prisma persists from
    // the UTC date components. Building with the local-time `new Date(y, m, d)`
    // constructor shifts every holiday back one day when the host runs ahead of
    // UTC (e.g. Europe/Paris = +01/+02), so a May 1 holiday lands on April 30.
    return new Date(Date.UTC(year, month, day));
  }

  /**
   * Ajoute des jours à une date
   */
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  /**
   * Normalise a Date to UTC midnight using its *local* calendar components.
   *
   * The @db.Date column is matched by Prisma using the UTC date embedded in
   * the timestamp.  A caller that passes a local-constructed Date (e.g.
   * `new Date(year, month, day)`) on a +UTC host (Europe/Paris) produces a
   * timestamp that is 23:00 of the *previous* UTC day, causing findUnique to
   * miss the record.  Re-building the Date from the local components via
   * Date.UTC pins it to 00:00:00Z of the intended calendar day.
   */
  private toLocalDayUtcMidnight(date: Date): Date {
    return new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
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
      // Jours fériés à date fixe (UTC midnight — see calculateEaster note: the
      // `@db.Date` column persists UTC date components, so local-time Date
      // construction would shift each holiday back a day under +UTC hosts).
      {
        name: "Jour de l'An",
        date: new Date(Date.UTC(year, 0, 1)),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Fête du Travail',
        date: new Date(Date.UTC(year, 4, 1)),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Victoire 1945',
        date: new Date(Date.UTC(year, 4, 8)),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Fête Nationale',
        date: new Date(Date.UTC(year, 6, 14)),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Assomption',
        date: new Date(Date.UTC(year, 7, 15)),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Toussaint',
        date: new Date(Date.UTC(year, 10, 1)),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Armistice 1918',
        date: new Date(Date.UTC(year, 10, 11)),
        type: HolidayType.LEGAL,
      },
      {
        name: 'Noël',
        date: new Date(Date.UTC(year, 11, 25)),
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
    // Normalise to UTC midnight from the local calendar day so the @db.Date
    // key matches regardless of the caller's construction method or host TZ.
    const normalised = this.toLocalDayUtcMidnight(date);
    const holiday = await this.prisma.holiday.findUnique({
      where: { date: normalised },
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
      // Use UTC accessors to stay consistent with toISOString() (UTC) and to
      // avoid DST-induced off-by-one errors: setDate(getDate()+1) on a
      // Europe/Paris host advances by only 23 h on the spring-forward day
      // (double-counting) or 25 h on the fall-back day (skipping the last day).
      // setUTCDate/getUTCDate always advance by exactly 24 h. [closes COR-013]
      const dayOfWeek = current.getUTCDay();
      const dateStr = current.toISOString().split('T')[0];

      // Exclut samedi (6) et dimanche (0) et jours fériés non ouvrés
      if (
        dayOfWeek !== 0 &&
        dayOfWeek !== 6 &&
        !nonWorkingHolidayDates.has(dateStr)
      ) {
        count++;
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return count;
  }
}
