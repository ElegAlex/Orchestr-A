// Script one-shot de vérification de fidélité de migration.
//
// Pour chaque paire (rôle legacy, template cible) du mapping
// LEGACY_ROLE_MIGRATION :
//   1. Extrait les permissions actuelles du rôle legacy depuis la matrice
//      `docs/rbac/ROLES-PERMISSIONS.md`.
//   2. Applique les normalisations D4/D5/D6/D7 :
//       - Drop les 10 perms `:view`/`:edit` (D4 Cat A)
//       - Drop `telework:manage_recurring` (D4 Cat C)
//       - Drop `analytics:read`/`analytics:export` (D5)
//       - Rename `telework:manage_others` → `telework:manage_any` (D7)
//   3. Compare le set normalisé au `ROLE_TEMPLATES[target].permissions`.
//   4. Reporte toute perm présente dans le legacy normalisé mais absente du
//      template cible (régression).

import { readFileSync } from 'node:fs';
import {
  ROLE_TEMPLATES,
  LEGACY_ROLE_MIGRATION,
  type RoleTemplateKey,
} from './contract-02-templates.ts';

type PermSet = Set<string>;

// ─── Normalisations ───────────────────────────────────────────────────────

const D4_CAT_A_DROP = new Set([
  'departments:edit',
  'departments:view',
  'projects:edit',
  'projects:view',
  'skills:edit',
  'skills:view',
  'users:edit',
  'users:view',
  'leaves:view',
  'telework:view',
]);

const D4_CAT_C_DROP = new Set(['telework:manage_recurring']);

const D5_DROP = new Set(['analytics:read', 'analytics:export']);

function normalize(perms: readonly string[]): PermSet {
  const out = new Set<string>();
  for (const p of perms) {
    if (D4_CAT_A_DROP.has(p)) continue;
    if (D4_CAT_C_DROP.has(p)) continue;
    if (D5_DROP.has(p)) continue;
    if (p === 'telework:manage_others') {
      out.add('telework:manage_any'); // D7 rename
      continue;
    }
    out.add(p);
  }
  return out;
}

// ─── Parsing de la matrice ROLES-PERMISSIONS.md ──────────────────────────

const MATRIX_PATH =
  '/home/alex/Documents/REPO/ORCHESTRA/docs/rbac/ROLES-PERMISSIONS.md';

function parseMatrix(): Record<string, string[]> {
  const content = readFileSync(MATRIX_PATH, 'utf-8');
  const lines = content.split('\n');

  // La matrice a un header de la forme :
  //   | Permission | Module | Action | ADMIN | ADMINISTRATEUR_IML | ... |
  // Puis des lignes :
  //   | `perm:code` | module | action | ✅ |  | ✅ | ... |

  // Trouver la ligne header qui commence par "| Permission | Module | Action |"
  const headerIdx = lines.findIndex((l) =>
    l.trim().startsWith('| Permission |') && l.includes('| Module |'),
  );
  if (headerIdx === -1) {
    throw new Error('Header de matrice introuvable');
  }
  const headerLine = lines[headerIdx];
  const headerCells = headerLine
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  // headerCells = ['Permission', 'Module', 'Action', 'ADMIN', ...]

  const roleCodes = headerCells.slice(3); // après Permission/Module/Action

  const perRole: Record<string, string[]> = {};
  for (const code of roleCodes) {
    perRole[code] = [];
  }

  // Les lignes data commencent après la ligne séparateur `|---|---|...|`
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line.startsWith('|')) break; // fin de la table
    const cells = line.split('|').map((c) => c.trim());
    // cells = ['', '`perm:code`', 'module', 'action', '✅', '', ...]
    const permRaw = cells[1]; // `perm:code` (entouré de backticks)
    const match = permRaw.match(/^`(.+?)`$/);
    if (!match) continue;
    const permCode = match[1];
    // cells[4..4+roleCodes.length] = valeurs par rôle
    for (let r = 0; r < roleCodes.length; r++) {
      const val = cells[4 + r] ?? '';
      if (val === '✅') {
        perRole[roleCodes[r]].push(permCode);
      }
    }
  }
  return perRole;
}

// ─── Exécution ───────────────────────────────────────────────────────────

const legacyPerms = parseMatrix();

console.log('Fidélité migration — 15 rôles legacy → templates cibles');
console.log('');
console.log('Colonnes :');
console.log('  LegacyRole               : code DB actuel');
console.log('  Target                   : templateKey cible');
console.log('  #Legacy                  : # perms avant norm');
console.log('  #LegacyNorm              : # perms après norm (D4/D5/D7)');
console.log('  #Target                  : # perms template cible');
console.log('  Missing in target        : perms perdues (régression !)');
console.log('  Gained in target         : perms supplémentaires (acceptable)');
console.log('');

let regressionsTotal = 0;
const report: string[] = [];

for (const legacyRole of Object.keys(LEGACY_ROLE_MIGRATION)) {
  const target = LEGACY_ROLE_MIGRATION[
    legacyRole
  ] as RoleTemplateKey;
  const rawPerms = legacyPerms[legacyRole] ?? [];
  const normalized = normalize(rawPerms);
  const targetPerms = new Set<string>(ROLE_TEMPLATES[target].permissions);

  const missing: string[] = [];
  for (const p of normalized) {
    if (!targetPerms.has(p)) missing.push(p);
  }
  const gained: string[] = [];
  for (const p of targetPerms) {
    if (!normalized.has(p)) gained.push(p);
  }

  if (missing.length > 0) regressionsTotal += missing.length;

  const status = missing.length === 0 ? '✓ OK' : `✗ ${missing.length} perte(s)`;
  report.push(
    `${legacyRole.padEnd(45)} → ${target.padEnd(30)} ` +
      `#leg=${String(rawPerms.length).padStart(3)} ` +
      `#norm=${String(normalized.size).padStart(3)} ` +
      `#tgt=${String(targetPerms.size).padStart(3)} ` +
      `${status}`,
  );
  if (missing.length > 0) {
    for (const p of missing.sort()) {
      report.push(`    MISSING: ${p}`);
    }
  }
  if (gained.length > 0) {
    report.push(
      `    gained: ${gained.length} perms (extension D4 Cat B + corrections PO)`,
    );
  }
}

console.log(report.join('\n'));
console.log('');
console.log(
  `TOTAL régressions : ${regressionsTotal} (0 attendu — doctrine "aucune régression de droit métier")`,
);
console.log(`EXIT: ${regressionsTotal === 0 ? 0 : 1}`);
process.exit(regressionsTotal === 0 ? 0 : 1);
