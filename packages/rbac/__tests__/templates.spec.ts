import { describe, it, expect } from "vitest";
import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_KEYS,
  CATALOG_PERMISSIONS,
  type PermissionCode,
  type RoleTemplateKey,
} from "..";

/**
 * Tests V0 B — conformité du package `rbac` aux contrats Phase 1.
 *
 * Critères du bloc d'invocation Spec 2 V0 B :
 *  (a) pour chaque template, le count effectif correspond exactement à la
 *      table §9 de contract-05-spec2-spec3-inputs.md (counts normatifs
 *      post-corrections PO 2026-04-19).
 *  (b) test de cohérence : aucune permission inconnue (toutes présentes
 *      dans CATALOG_PERMISSIONS).
 */

// Counts normatifs §9 de contract-05-spec2-spec3-inputs.md
// Mise à jour 2026-04-23 : module Clients V1 ajoute 5 permissions au
// catalogue (CATALOG_PERMISSIONS 107 → 112) et distribue selon §15
// du spec clients-module-design.
// Mise à jour 2026-04-24 : W0.6 — +4 permissions Planning activités récurrentes
// (CATALOG_PERMISSIONS 112 → 116). planning:activity-view → COMMON_BASE (+1 tous
// les templates passant par COMMON_BASE ou explicite OBSERVER). predefined_tasks:balance
// et predefined_tasks:update-any-status → PREDEFINED_TASKS_ADMIN (+2). predefined_tasks:update-own-status
// → STANDARD_SELF_SERVICE (+1 tous templates self-service composite).
const EXPECTED_COUNTS: Record<RoleTemplateKey, number> = {
  ADMIN: 116,
  ADMIN_DELEGATED: 113,
  PORTFOLIO_MANAGER: 82,
  MANAGER: 85,
  MANAGER_PROJECT_FOCUS: 78,
  MANAGER_HR_FOCUS: 49,
  PROJECT_LEAD: 66,
  PROJECT_LEAD_JUNIOR: 63,
  TECHNICAL_LEAD: 48,
  PROJECT_CONTRIBUTOR: 57,
  PROJECT_CONTRIBUTOR_LIGHT: 49,
  FUNCTIONAL_REFERENT: 44,
  HR_OFFICER: 41,
  HR_OFFICER_LIGHT: 21,
  THIRD_PARTY_MANAGER: 55,
  CONTROLLER: 29,
  BUDGET_ANALYST: 18,
  DATA_ANALYST: 15,
  IT_SUPPORT: 29,
  IT_INFRASTRUCTURE: 34,
  OBSERVER_FULL: 26,
  OBSERVER_PROJECTS_ONLY: 22,
  OBSERVER_HR_ONLY: 14,
  BASIC_USER: 30,
  EXTERNAL_PRESTATAIRE: 46,
  STAGIAIRE_ALTERNANT: 29,
};

describe("rbac — conformité contrats Phase 1", () => {
  it("CATALOG_PERMISSIONS contient exactement 116 permissions", () => {
    expect(CATALOG_PERMISSIONS.length).toBe(116);
  });

  it("CATALOG_PERMISSIONS sans doublon", () => {
    const set = new Set(CATALOG_PERMISSIONS);
    expect(set.size).toBe(CATALOG_PERMISSIONS.length);
  });

  it("ROLE_TEMPLATE_KEYS contient exactement 26 templates", () => {
    expect(ROLE_TEMPLATE_KEYS.length).toBe(26);
  });

  it("ROLE_TEMPLATES contient exactement 26 entrées", () => {
    expect(Object.keys(ROLE_TEMPLATES).length).toBe(26);
  });

  describe("counts normatifs (V0 B critère a)", () => {
    for (const key of ROLE_TEMPLATE_KEYS) {
      const expected = EXPECTED_COUNTS[key];
      it(`${key} → ${expected} permissions`, () => {
        const tpl = ROLE_TEMPLATES[key];
        expect(tpl.permissions.length).toBe(expected);
      });
    }
  });

  describe("cohérence permissions (V0 B critère b)", () => {
    const catalogSet = new Set<PermissionCode>(CATALOG_PERMISSIONS);

    for (const key of ROLE_TEMPLATE_KEYS) {
      it(`${key} : toutes les permissions sont dans CATALOG_PERMISSIONS`, () => {
        const tpl = ROLE_TEMPLATES[key];
        const orphan: PermissionCode[] = [];
        for (const p of tpl.permissions) {
          if (!catalogSet.has(p)) orphan.push(p);
        }
        expect(orphan).toEqual([]);
      });

      it(`${key} : permissions sans doublon`, () => {
        const tpl = ROLE_TEMPLATES[key];
        const set = new Set<PermissionCode>(tpl.permissions);
        expect(set.size).toBe(tpl.permissions.length);
      });
    }
  });

  describe("métadonnées templates", () => {
    for (const key of ROLE_TEMPLATE_KEYS) {
      it(`${key} a key/category/defaultLabel/description renseignés`, () => {
        const tpl = ROLE_TEMPLATES[key];
        expect(tpl.key).toBe(key);
        expect(tpl.category).toMatch(/^[A-Z_]+$/);
        expect(tpl.defaultLabel.length).toBeGreaterThan(0);
        expect(tpl.description.length).toBeGreaterThan(0);
      });
    }
  });
});
