/**
 * occurrence-generator.ts
 *
 * Générateur pur et déterministe d'occurrences de règles récurrentes.
 * Zéro I/O, zéro dépendances externes. Toutes les dates sont à minuit UTC.
 *
 * Convention dayOfWeek : 0=Lundi, 1=Mardi, …, 6=Dimanche (≠ JS natif)
 * JS natif : 0=Dim, 1=Lun, …, 6=Sam
 */

export interface RuleLike {
  id: string;
  recurrenceType: 'WEEKLY' | 'MONTHLY_ORDINAL' | 'MONTHLY_DAY';
  dayOfWeek: number | null; // 0=Lundi..6=Dimanche
  weekInterval: number; // pour WEEKLY uniquement, ignoré sinon
  monthlyOrdinal: number | null; // 1..5 (5 = dernière occurrence)
  monthlyDayOfMonth: number | null; // 1..31
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

export class InvalidRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRuleError';
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Convertit un dayOfWeek JS (0=Dim..6=Sam) vers notre convention (0=Lun..6=Dim) */
function jsToOur(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

/** Convertit notre convention (0=Lun..6=Dim) vers JS (0=Dim..6=Sam) */
function ourToJs(ourDay: number): number {
  return ourDay === 6 ? 0 : ourDay + 1;
}

/** Retourne minuit UTC pour l'année/mois/jour donnés (mois 0-indexé) */
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Retourne le nombre de jours dans un mois donné (mois 0-indexé) */
function daysInMonth(year: number, month: number): number {
  // Date.UTC(year, month+1, 0) = dernier jour du mois
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** Clone une Date UTC en ajoutant N jours */
function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

// ─── Génération par type ────────────────────────────────────────────────────

function generateWeekly(
  rule: RuleLike,
  effectiveStart: Date,
  effectiveEnd: Date,
): Date[] {
  if (rule.dayOfWeek === null) {
    throw new InvalidRuleError('WEEKLY : dayOfWeek est requis');
  }

  const targetJsDay = ourToJs(rule.dayOfWeek);
  const interval = rule.weekInterval >= 1 ? rule.weekInterval : 1;

  // Calcul de l'ancre : première occurrence du dayOfWeek à partir de rule.startDate
  const ruleStartJsDay = rule.startDate.getUTCDay();
  const daysToFirst = (targetJsDay - ruleStartJsDay + 7) % 7;
  const anchor = addDaysUTC(rule.startDate, daysToFirst);

  const dates: Date[] = [];

  // Trouver la première occurrence dans la plage
  let current: Date;
  const anchorMs = anchor.getTime();
  const effectiveStartMs = effectiveStart.getTime();

  if (anchorMs >= effectiveStartMs) {
    current = anchor;
  } else {
    // Calculer combien de semaines sont nécessaires pour atteindre effectiveStart
    const diffMs = effectiveStartMs - anchorMs;
    const diffWeeks = Math.ceil(diffMs / (7 * 86400000));
    // Arrondir au multiple de interval supérieur
    const weeksOffset = Math.ceil(diffWeeks / interval) * interval;
    current = addDaysUTC(anchor, weeksOffset * 7);
  }

  const effectiveEndMs = effectiveEnd.getTime();

  while (current.getTime() <= effectiveEndMs) {
    // Vérifier que c'est bien le bon jour (robustesse)
    if (current.getUTCDay() === targetJsDay) {
      // Vérifier l'intervalle (diffWeeks depuis l'ancre doit être multiple de interval)
      const diffMs = current.getTime() - anchorMs;
      const diffWeeks = Math.round(diffMs / (7 * 86400000));
      if (diffWeeks % interval === 0) {
        dates.push(current);
      }
    }
    current = addDaysUTC(current, interval * 7);
  }

  return dates;
}

function generateMonthlyDay(
  rule: RuleLike,
  effectiveStart: Date,
  effectiveEnd: Date,
): Date[] {
  if (rule.monthlyDayOfMonth === null) {
    throw new InvalidRuleError('MONTHLY_DAY : monthlyDayOfMonth est requis');
  }
  if (rule.dayOfWeek !== null) {
    throw new InvalidRuleError(
      'MONTHLY_DAY : dayOfWeek doit être null (incompatible avec ce type)',
    );
  }

  const targetDay = rule.monthlyDayOfMonth;
  const dates: Date[] = [];

  // Mois de début : le mois contenant effectiveStart
  let year = effectiveStart.getUTCFullYear();
  let month = effectiveStart.getUTCMonth(); // 0-indexé

  const effectiveEndMs = effectiveEnd.getTime();

  while (true) {
    // Clamp le jour au nombre de jours dans ce mois
    const maxDay = daysInMonth(year, month);
    const actualDay = Math.min(targetDay, maxDay);
    const candidate = utcDate(year, month, actualDay);

    if (candidate.getTime() > effectiveEndMs) {
      break;
    }

    if (candidate.getTime() >= effectiveStart.getTime()) {
      dates.push(candidate);
    }

    // Passer au mois suivant
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }

  return dates;
}

function generateMonthlyOrdinal(
  rule: RuleLike,
  effectiveStart: Date,
  effectiveEnd: Date,
): Date[] {
  if (rule.monthlyOrdinal === null) {
    throw new InvalidRuleError('MONTHLY_ORDINAL : monthlyOrdinal est requis');
  }
  if (rule.dayOfWeek === null) {
    throw new InvalidRuleError('MONTHLY_ORDINAL : dayOfWeek est requis');
  }

  const ordinal = rule.monthlyOrdinal; // 1..5 (5 = dernier)
  const targetJsDay = ourToJs(rule.dayOfWeek);
  const dates: Date[] = [];

  let year = effectiveStart.getUTCFullYear();
  let month = effectiveStart.getUTCMonth();

  const effectiveEndMs = effectiveEnd.getTime();

  while (true) {
    let candidate: Date;

    if (ordinal === 5) {
      // Dernière occurrence du dayOfWeek dans le mois
      const lastDay = daysInMonth(year, month);
      const lastDate = utcDate(year, month, lastDay);
      const lastJsDay = lastDate.getUTCDay();
      const daysBack = (lastJsDay - targetJsDay + 7) % 7;
      candidate = utcDate(year, month, lastDay - daysBack);
    } else {
      // N-ième occurrence (1..4)
      // Trouver le premier jour du mois avec le bon dayOfWeek
      const firstDate = utcDate(year, month, 1);
      const firstJsDay = firstDate.getUTCDay();
      const daysToFirst = (targetJsDay - firstJsDay + 7) % 7;
      const firstOccurrence = daysToFirst + 1; // jour du mois (1-indexé)
      // N-ième occurrence = firstOccurrence + (ordinal-1)*7
      const targetDayOfMonth = firstOccurrence + (ordinal - 1) * 7;

      const maxDay = daysInMonth(year, month);
      if (targetDayOfMonth > maxDay) {
        // Cette occurrence n'existe pas ce mois (ex: 5e mardi en fév)
        // On passe au mois suivant sans émettre
        month++;
        if (month > 11) {
          month = 0;
          year++;
        }
        // Vérifier qu'on n'est pas allé trop loin
        if (utcDate(year, month, 1).getTime() > effectiveEndMs) {
          break;
        }
        continue;
      }

      candidate = utcDate(year, month, targetDayOfMonth);
    }

    if (candidate.getTime() > effectiveEndMs) {
      break;
    }

    if (candidate.getTime() >= effectiveStart.getTime()) {
      dates.push(candidate);
    }

    month++;
    if (month > 11) {
      month = 0;
      year++;
    }

    // Protection : si on dépasse la plage, sortir
    if (utcDate(year, month, 1).getTime() > effectiveEndMs) {
      break;
    }
  }

  return dates;
}

// ─── Export principal ────────────────────────────────────────────────────────

/**
 * Retourne les dates UTC-midnight où une règle doit créer une assignation,
 * dans la plage [rangeStart, rangeEnd].
 *
 * @throws InvalidRuleError si la règle est incohérente
 */
export function generateOccurrences(
  rule: RuleLike,
  rangeStart: Date,
  rangeEnd: Date,
): Date[] {
  // Règle inactive
  if (!rule.isActive) {
    return [];
  }

  // Règle hors plage
  if (rule.startDate > rangeEnd) {
    return [];
  }
  if (rule.endDate && rule.endDate < rangeStart) {
    return [];
  }

  // Clipping
  const effectiveStart =
    rule.startDate > rangeStart ? rule.startDate : rangeStart;
  const effectiveEnd =
    rule.endDate && rule.endDate < rangeEnd ? rule.endDate : rangeEnd;

  switch (rule.recurrenceType) {
    case 'WEEKLY':
      return generateWeekly(rule, effectiveStart, effectiveEnd);
    case 'MONTHLY_DAY':
      return generateMonthlyDay(rule, effectiveStart, effectiveEnd);
    case 'MONTHLY_ORDINAL':
      return generateMonthlyOrdinal(rule, effectiveStart, effectiveEnd);
    default: {
      // TypeScript exhaustiveness — ne devrait pas arriver
      const exhaustive: never = rule.recurrenceType;
      throw new InvalidRuleError(`Type de récurrence inconnu : ${exhaustive}`);
    }
  }
}
