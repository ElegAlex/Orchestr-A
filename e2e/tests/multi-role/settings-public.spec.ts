/**
 * Tests RBAC — Settings : projection publique + régression sauvegarde planning
 *
 * Contexte (bug terrain Ramage) :
 *   1. Les jours visibles du planning semblaient « figés par rôle » : ADMIN /
 *      RESPONSABLE / MANAGER (qui ont `settings:read`) chargeaient le réglage
 *      global, les autres rôles retombaient sur le défaut codé en dur Lun–Ven.
 *      → Correctif : GET /api/settings/public, lisible par TOUT rôle authentifié,
 *        expose la config d'affichage non sensible (formats + jours visibles).
 *   2. La sauvegarde des paramètres (POST /api/settings/bulk) renvoyait 400 dès
 *      que la map contenait `planning.schoolVacationZone` (clé front jamais
 *      whitelistée côté API). → Correctif : clé ajoutée au whitelist/seed.
 *
 * Sources :
 *   - apps/api/src/settings/settings.controller.ts (GET /settings/public)
 *   - apps/api/src/settings/settings.service.ts (findPublic + DEFAULT_SETTINGS)
 *   - apps/web/src/components/AuthProvider.tsx (fetchPublicSettings sans perm)
 */

import { test, expect } from "../../fixtures/test-fixtures";
import { ROLES } from "../../fixtures/roles";

// Rôles dont le template porte `settings:read` (RBAC v4 §NOTE 3). Les autres
// ne lisent PAS la map complète mais doivent quand même obtenir la projection
// publique — c'est précisément l'origine de l'impression « figé par rôle ».
const ROLES_WITH_SETTINGS_READ = new Set(["admin", "responsable", "manager"]);

test.describe("Settings — projection publique (tous rôles)", () => {
  for (const role of ROLES) {
    test(`${role} : GET /api/settings/public renvoie 200 + jours visibles`, async ({
      asRole,
    }) => {
      const page = await asRole(role);
      const res = await page.request.get("/api/settings/public");

      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        settings: Record<string, unknown>;
      };
      // La config d'affichage globale doit parvenir à TOUS les rôles.
      expect(Array.isArray(body.settings["planning.visibleDays"])).toBe(true);
      // Aucune clé sensible (entitlements) ne doit fuiter dans la projection.
      expect(body.settings).not.toHaveProperty("defaultLeaveDays");
      expect(body.settings).not.toHaveProperty("maxTeleworkDaysPerWeek");
    });
  }
});

test.describe("Settings — map complète reste gâtée (négatif)", () => {
  for (const role of ROLES) {
    const expected = ROLES_WITH_SETTINGS_READ.has(role);
    test(`${role} : GET /api/settings → ${expected ? "200" : "403"}`, async ({
      asRole,
    }) => {
      const page = await asRole(role);
      const res = await page.request.get("/api/settings");

      if (expected) {
        expect(res.status()).toBe(200);
      } else {
        // Sans settings:read : la map complète reste interdite (§NOTE 3).
        expect([401, 403]).toContain(res.status());
      }
    });
  }
});

test.describe("Settings — régression 400 sur sauvegarde planning", () => {
  test("@smoke ADMIN : POST /api/settings/bulk avec schoolVacationZone ne renvoie PAS 400", async ({
    asRole,
  }) => {
    const page = await asRole("admin");
    const res = await page.request.post("/api/settings/bulk", {
      data: {
        settings: {
          "planning.visibleDays": [1, 2, 3, 4, 5, 6],
          "planning.specialDays": [6],
          // La clé qui faisait planter toute la sauvegarde (Unknown setting key).
          "planning.schoolVacationZone": "C",
        },
      },
    });

    expect(res.status()).not.toBe(400);
    expect([200, 201]).toContain(res.status());
  });
});
