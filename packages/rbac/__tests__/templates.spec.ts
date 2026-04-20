import { describe, it, expect } from 'vitest';
import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_KEYS,
  CATALOG_PERMISSIONS,
  type PermissionCode,
  type RoleTemplateKey,
} from '..';

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
const EXPECTED_COUNTS: Record<RoleTemplateKey, number> = {
  ADMIN: 108,
  ADMIN_DELEGATED: 105,
  PORTFOLIO_MANAGER: 73,
  MANAGER: 79,
  MANAGER_PROJECT_FOCUS: 72,
  MANAGER_HR_FOCUS: 45,
  PROJECT_LEAD: 62,
  PROJECT_LEAD_JUNIOR: 59,
  TECHNICAL_LEAD: 45,
  PROJECT_CONTRIBUTOR: 54,
  PROJECT_CONTRIBUTOR_LIGHT: 46,
  FUNCTIONAL_REFERENT: 41,
  HR_OFFICER: 38,
  HR_OFFICER_LIGHT: 20,
  THIRD_PARTY_MANAGER: 52,
  CONTROLLER: 27,
  BUDGET_ANALYST: 17,
  DATA_ANALYST: 14,
  IT_SUPPORT: 28,
  IT_INFRASTRUCTURE: 33,
  OBSERVER_FULL: 24,
  OBSERVER_PROJECTS_ONLY: 20,
  OBSERVER_HR_ONLY: 13,
  BASIC_USER: 28,
  EXTERNAL_PRESTATAIRE: 43,
  STAGIAIRE_ALTERNANT: 27,
};

describe('rbac — conformité contrats Phase 1', () => {
  it('CATALOG_PERMISSIONS contient exactement 108 permissions', () => {
    expect(CATALOG_PERMISSIONS.length).toBe(108);
  });

  it('CATALOG_PERMISSIONS sans doublon', () => {
    const set = new Set(CATALOG_PERMISSIONS);
    expect(set.size).toBe(CATALOG_PERMISSIONS.length);
  });

  it('ROLE_TEMPLATE_KEYS contient exactement 26 templates', () => {
    expect(ROLE_TEMPLATE_KEYS.length).toBe(26);
  });

  it('ROLE_TEMPLATES contient exactement 26 entrées', () => {
    expect(Object.keys(ROLE_TEMPLATES).length).toBe(26);
  });

  describe('counts normatifs (V0 B critère a)', () => {
    for (const key of ROLE_TEMPLATE_KEYS) {
      const expected = EXPECTED_COUNTS[key];
      it(`${key} → ${expected} permissions`, () => {
        const tpl = ROLE_TEMPLATES[key];
        expect(tpl.permissions.length).toBe(expected);
      });
    }
  });

  describe('cohérence permissions (V0 B critère b)', () => {
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

  describe('métadonnées templates', () => {
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
