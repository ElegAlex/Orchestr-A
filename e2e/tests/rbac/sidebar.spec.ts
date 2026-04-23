/**
 * Tests RBAC — Sidebar (V1B)
 *
 * Vérifie que la sidebar (MainLayout.tsx) affiche les bons items de navigation
 * selon le rôle de l'utilisateur connecté.
 *
 * Source de rendu : apps/web/src/components/MainLayout.tsx
 *   - navigation[] (items de base) — filtré par permission
 *   - adminNavigation[] (section Administration) — filtré par permission ou adminOnly
 *   - Section Administration visible ssi au moins un item admin est accessible
 *
 * Permissions clés :
 *   - ADMIN          : 107 perms → TOUS les items visibles
 *   - MANAGER        : a reports:view, skills:read, third_parties:read, users:manage,
 *                      departments:read ; PAS users:manage_roles ni settings:update
 *                      → voit Administration sans "Gestion des rôles" ni "Paramètres"
 *   - CONTRIBUTEUR   : n'a PAS projects:read → pas d'item Projets
 *                      a departments:read → Administration visible avec juste Départements
 *
 * Les assertions ciblent les libellés FR (apps/web/messages/fr/common.json > nav.*).
 * Tag @smoke pour le scénario ADMIN (critique pour le régression RBAC UI).
 */

import { test, expect, type Page } from "../../fixtures/test-fixtures";

const BASE = process.env.CI ? "http://localhost:3000" : "http://localhost:4001";

// Libellés FR des items de navigation (source : apps/web/messages/fr/common.json)
const NAV_LABELS = {
  dashboard: "Tableau de bord",
  projects: "Projets",
  tasks: "Tâches",
  events: "Événements",
  planning: "Planning",
  timeTracking: "Suivi du temps",
  leaves: "Congés",
  telework: "Télétravail",
  // Admin section
  reports: "Rapports",
  users: "Utilisateurs",
  departments: "Départements",
  skills: "Compétences",
  thirdParties: "Tiers",
  roleManagement: "Gestion des rôles",
  settings: "Paramètres",
  administration: "Administration",
} as const;

/**
 * Retourne un locator ciblant un lien de sidebar par son libellé visible.
 * Les liens ont la structure <a href="..."><span>icon</span><span>{label}</span></a>
 * dans MainLayout.tsx. On cible la <nav> pour éviter les faux positifs avec
 * d'autres éléments de la page (ex: un header, un breadcrumb).
 */
function sidebarLink(page: Page, label: string) {
  return page
    .locator("aside nav")
    .getByRole("link", { name: label, exact: false });
}

/**
 * En dev mode Next.js 16, un overlay d'erreur apparaît si une route API
 * renvoie 403 (ex: /api/settings pour CONTRIBUTEUR/OBSERVATEUR).
 * Cette fonction le ferme pour que la sidebar redevienne interactive.
 */
async function dismissDevErrorOverlay(page: Page) {
  // Le dialog d'erreur Next.js a role="dialog" avec "Console AxiosError" ou similaire.
  // On le ferme via Escape si présent (Next.js écoute Escape pour fermer l'overlay).
  const overlay = page.locator(
    "nextjs-portal, [data-nextjs-dialog], nextjs-build-indicator",
  );
  if ((await overlay.count()) > 0) {
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(200);
  }
}

/**
 * Attend que la sidebar soit rendue (détecte que le chargement de /me est passé
 * et que le MainLayout est monté). En dev, ferme l'overlay d'erreur Next.js
 * s'il est visible.
 */
async function waitForSidebar(page: Page) {
  // La sidebar est rendue dans le DOM dès que MainLayout monte, même si un
  // overlay dev la recouvre. On utilise `state: 'attached'` pour ne pas être
  // bloqué par la visibilité.
  await page.waitForSelector("aside nav", {
    state: "attached",
    timeout: 15000,
  });
  await dismissDevErrorOverlay(page);
  // Le dashboard link est toujours présent (pas de permission requise)
  await expect(
    page
      .locator("aside nav")
      .getByText(NAV_LABELS.dashboard, { exact: false })
      .first(),
  ).toBeVisible({ timeout: 10000 });
}

test.describe("UI — Sidebar par rôle", () => {
  test("ADMIN : voit tous les items (base + administration complète) @smoke", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    await page.goto(`${BASE}/fr/dashboard`);
    await waitForSidebar(page);

    // Items de base (8)
    for (const key of [
      "dashboard",
      "projects",
      "tasks",
      "events",
      "planning",
      "timeTracking",
      "leaves",
      "telework",
    ] as const) {
      await expect(
        sidebarLink(page, NAV_LABELS[key]),
        `ADMIN doit voir l'item sidebar "${key}" (${NAV_LABELS[key]})`,
      ).toBeVisible();
    }

    // Section Administration visible
    await expect(
      page.locator("aside nav").getByText(NAV_LABELS.administration, {
        exact: false,
      }),
    ).toBeVisible();

    // Items admin (7)
    for (const key of [
      "reports",
      "users",
      "departments",
      "skills",
      "thirdParties",
      "roleManagement",
      "settings",
    ] as const) {
      await expect(
        sidebarLink(page, NAV_LABELS[key]),
        `ADMIN doit voir l'item admin "${key}" (${NAV_LABELS[key]})`,
      ).toBeVisible();
    }
  });

  test("MANAGER : voit items base + admin (reports/users/departments/skills/thirdParties) mais PAS roleManagement/settings", async ({
    asRole,
  }) => {
    const page = await asRole("manager");
    await page.goto(`${BASE}/fr/dashboard`);
    await waitForSidebar(page);

    // Items de base — MANAGER a projects:read, tasks:read, events:read, time_tracking:read, leaves:read, telework:read
    for (const key of [
      "dashboard",
      "projects",
      "tasks",
      "events",
      "planning",
      "timeTracking",
      "leaves",
      "telework",
    ] as const) {
      await expect(
        sidebarLink(page, NAV_LABELS[key]),
        `MANAGER doit voir l'item sidebar "${key}"`,
      ).toBeVisible();
    }

    // Section Administration visible (a reports:view, users:manage, departments:read, skills:read, third_parties:read)
    await expect(
      page.locator("aside nav").getByText(NAV_LABELS.administration, {
        exact: false,
      }),
    ).toBeVisible();

    // Items admin accessibles à MANAGER
    for (const key of [
      "reports",
      "users",
      "departments",
      "skills",
      "thirdParties",
    ] as const) {
      await expect(
        sidebarLink(page, NAV_LABELS[key]),
        `MANAGER doit voir l'item admin "${key}"`,
      ).toBeVisible();
    }

    // Items adminOnly — MANAGER n'a ni users:manage_roles ni settings:update
    await expect(
      sidebarLink(page, NAV_LABELS.roleManagement),
      "MANAGER NE doit PAS voir 'Gestion des rôles' (users:manage_roles manquant)",
    ).toHaveCount(0);
    await expect(
      sidebarLink(page, NAV_LABELS.settings),
      "MANAGER NE doit PAS voir 'Paramètres' (users:manage_roles manquant)",
    ).toHaveCount(0);
  });

  test("CONTRIBUTEUR (BASIC_USER) : voit items de base limités, Administration visible uniquement avec Départements", async ({
    asRole,
  }) => {
    const page = await asRole("contributeur");
    // NOTE : /fr/dashboard et /fr/planning déclenchent un "Maximum update
    // depth exceeded" en dev mode pour CONTRIBUTEUR (getSnapshot non-cached
    // dans une store zustand selector côté planning/dashboard). Bug préexistant
    // indépendant de la sidebar. On charge /fr/tasks qui monte MainLayout sans
    // trigger le bug.
    await page.goto(`${BASE}/fr/tasks`);
    await waitForSidebar(page);

    // Items de base visibles — CONTRIBUTEUR a tasks:read, events:read, time_tracking:read,
    // leaves:read, telework:read mais PAS projects:read. Dashboard et Planning sont sans
    // permission requise → toujours visibles.
    for (const key of [
      "dashboard",
      "tasks",
      "events",
      "planning",
      "timeTracking",
      "leaves",
      "telework",
    ] as const) {
      await expect(
        sidebarLink(page, NAV_LABELS[key]),
        `CONTRIBUTEUR doit voir l'item sidebar "${key}"`,
      ).toBeVisible();
    }

    // CONTRIBUTEUR n'a pas projects:read → item Projets caché
    await expect(
      sidebarLink(page, NAV_LABELS.projects),
      "CONTRIBUTEUR NE doit PAS voir 'Projets' (projects:read manquant)",
    ).toHaveCount(0);

    // CONTRIBUTEUR a departments:read → section Administration visible (comportement actuel)
    // avec un seul item : Départements. Tous les autres items admin doivent être absents.
    for (const hidden of [
      "reports",
      "users",
      "skills",
      "thirdParties",
      "roleManagement",
      "settings",
    ] as const) {
      await expect(
        sidebarLink(page, NAV_LABELS[hidden]),
        `CONTRIBUTEUR NE doit PAS voir l'item admin "${hidden}"`,
      ).toHaveCount(0);
    }

    await expect(
      sidebarLink(page, NAV_LABELS.departments),
      "CONTRIBUTEUR doit voir 'Départements' (departments:read présent)",
    ).toBeVisible();
  });
});
