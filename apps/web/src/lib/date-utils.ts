import { format, parseISO, isValid, Locale } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { useSettingsStore } from "@/stores/settings.store";

// Map des locales date-fns
const locales: Record<string, Locale> = {
  "fr-FR": fr,
  fr: fr,
  "en-US": enUS,
  en: enUS,
};

/**
 * Récupère la locale date-fns à partir de la locale des settings
 */
export function getDateLocale(): Locale {
  const locale = useSettingsStore.getState().getSetting("locale", "fr-FR");
  return locales[locale] || fr;
}

/**
 * Formate une date selon les paramètres de l'application
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatString?: string,
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (!isValid(dateObj)) return "";

  const settings = useSettingsStore.getState();
  const dateFormat =
    formatString || settings.getSetting("dateFormat", "dd/MM/yyyy");
  const locale = getDateLocale();

  return format(dateObj, dateFormat, { locale });
}

/**
 * Formate une date avec l'heure selon les paramètres de l'application
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  formatString?: string,
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (!isValid(dateObj)) return "";

  const settings = useSettingsStore.getState();
  const dateTimeFormat =
    formatString || settings.getSetting("dateTimeFormat", "dd/MM/yyyy HH:mm");
  const locale = getDateLocale();

  return format(dateObj, dateTimeFormat, { locale });
}

/**
 * Formate uniquement l'heure selon les paramètres de l'application
 */
export function formatTime(
  date: Date | string | null | undefined,
  formatString?: string,
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (!isValid(dateObj)) return "";

  const settings = useSettingsStore.getState();
  const timeFormat = formatString || settings.getSetting("timeFormat", "HH:mm");
  const locale = getDateLocale();

  return format(dateObj, timeFormat, { locale });
}

/**
 * Formate une date de manière relative (ex: "lundi 15 janvier")
 */
export function formatDateRelative(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (!isValid(dateObj)) return "";

  const locale = getDateLocale();
  return format(dateObj, "EEEE d MMMM", { locale });
}

/**
 * Formate une date de manière courte (ex: "15 janv.")
 */
export function formatDateShort(
  date: Date | string | null | undefined,
): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (!isValid(dateObj)) return "";

  const locale = getDateLocale();
  return format(dateObj, "d MMM", { locale });
}

/**
 * Formate une date de manière longue (ex: "15 janvier 2025")
 */
export function formatDateLong(date: Date | string | null | undefined): string {
  if (!date) return "";

  const dateObj = typeof date === "string" ? parseISO(date) : date;

  if (!isValid(dateObj)) return "";

  const locale = getDateLocale();
  return format(dateObj, "d MMMM yyyy", { locale });
}

/**
 * Hook pour utiliser le format de date dans les composants React
 */
export function useDateFormat() {
  const settings = useSettingsStore();

  return {
    dateFormat: settings.getSetting("dateFormat", "dd/MM/yyyy"),
    timeFormat: settings.getSetting("timeFormat", "HH:mm"),
    dateTimeFormat: settings.getSetting("dateTimeFormat", "dd/MM/yyyy HH:mm"),
    locale: getDateLocale(),
    formatDate,
    formatDateTime,
    formatTime,
    formatDateRelative,
    formatDateShort,
    formatDateLong,
  };
}
