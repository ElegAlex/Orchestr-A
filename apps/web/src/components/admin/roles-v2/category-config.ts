/**
 * Configuration des 9 catégories RBAC — libellés FR + couleurs Tailwind.
 *
 * Couleurs alignées sur `contract-02-templates.ts` §1 :
 *   A ADMINISTRATION   → Rouge
 *   B MANAGEMENT       → Orange
 *   C PROJECT          → Bleu
 *   D HR_AND_THIRD_PARTIES → Rose
 *   E ANALYTICS        → Violet
 *   F IT_OPERATIONS    → Cyan
 *   G OBSERVATION      → Gris
 *   H STANDARD_USER    → Vert
 *   I EXTERNAL         → Jaune
 */

import type { RoleCategoryKey } from "rbac";

export interface CategoryConfig {
  readonly key: RoleCategoryKey;
  readonly label: string;
  /** Classes Tailwind pour le badge (background + text). */
  readonly badgeClass: string;
  /** Classes Tailwind pour le badge actif (sélectionné dans un chip). */
  readonly activeChipClass: string;
  /** Classes Tailwind pour la bordure de la card (hover). */
  readonly cardAccentClass: string;
}

export const CATEGORY_CONFIG: Record<RoleCategoryKey, CategoryConfig> = {
  ADMINISTRATION: {
    key: "ADMINISTRATION",
    label: "Administration",
    badgeClass: "bg-red-100 text-red-800 border-red-200",
    activeChipClass: "bg-red-600 text-white border-red-600",
    cardAccentClass: "hover:border-red-400",
  },
  MANAGEMENT: {
    key: "MANAGEMENT",
    label: "Management",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-200",
    activeChipClass: "bg-orange-600 text-white border-orange-600",
    cardAccentClass: "hover:border-orange-400",
  },
  PROJECT: {
    key: "PROJECT",
    label: "Projet",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
    activeChipClass: "bg-blue-600 text-white border-blue-600",
    cardAccentClass: "hover:border-blue-400",
  },
  HR_AND_THIRD_PARTIES: {
    key: "HR_AND_THIRD_PARTIES",
    label: "RH & Prestataires",
    badgeClass: "bg-pink-100 text-pink-800 border-pink-200",
    activeChipClass: "bg-pink-600 text-white border-pink-600",
    cardAccentClass: "hover:border-pink-400",
  },
  ANALYTICS: {
    key: "ANALYTICS",
    label: "Analyse",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-200",
    activeChipClass: "bg-purple-600 text-white border-purple-600",
    cardAccentClass: "hover:border-purple-400",
  },
  IT_OPERATIONS: {
    key: "IT_OPERATIONS",
    label: "IT",
    badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-200",
    activeChipClass: "bg-cyan-600 text-white border-cyan-600",
    cardAccentClass: "hover:border-cyan-400",
  },
  OBSERVATION: {
    key: "OBSERVATION",
    label: "Observation",
    badgeClass: "bg-gray-100 text-gray-800 border-gray-200",
    activeChipClass: "bg-gray-600 text-white border-gray-600",
    cardAccentClass: "hover:border-gray-400",
  },
  STANDARD_USER: {
    key: "STANDARD_USER",
    label: "Utilisateur standard",
    badgeClass: "bg-green-100 text-green-800 border-green-200",
    activeChipClass: "bg-green-600 text-white border-green-600",
    cardAccentClass: "hover:border-green-400",
  },
  EXTERNAL: {
    key: "EXTERNAL",
    label: "Externe",
    badgeClass: "bg-yellow-100 text-yellow-800 border-yellow-200",
    activeChipClass: "bg-yellow-600 text-white border-yellow-600",
    cardAccentClass: "hover:border-yellow-400",
  },
};

/**
 * Ordre d'affichage des catégories (aligné sur le design doc §4 : A→I).
 * Utilisé par les chips de filtre et le tri visuel de la galerie.
 */
export const CATEGORY_ORDER: readonly RoleCategoryKey[] = [
  "ADMINISTRATION",
  "MANAGEMENT",
  "PROJECT",
  "HR_AND_THIRD_PARTIES",
  "ANALYTICS",
  "IT_OPERATIONS",
  "OBSERVATION",
  "STANDARD_USER",
  "EXTERNAL",
];

/**
 * Labels FR des modules de permissions (extrait de l'ancienne page
 * `/admin/roles/page.tsx`). Utilisé par `TemplateDetailsModal` pour grouper
 * les permissions par module.
 */
export const MODULE_LABELS: Record<string, string> = {
  projects: "Projets",
  tasks: "Tâches",
  events: "Événements",
  epics: "Épics",
  milestones: "Jalons",
  leaves: "Congés",
  telework: "Télétravail",
  skills: "Compétences",
  time_tracking: "Suivi du temps",
  users: "Utilisateurs",
  departments: "Départements",
  services: "Services",
  documents: "Documents",
  comments: "Commentaires",
  settings: "Paramètres",
  reports: "Rapports",
  holidays: "Jours fériés",
  school_vacations: "Vacances scolaires",
  predefined_tasks: "Tâches prédéfinies",
  third_parties: "Tiers",
};

export function getModuleLabel(module: string): string {
  return MODULE_LABELS[module] ?? module;
}
