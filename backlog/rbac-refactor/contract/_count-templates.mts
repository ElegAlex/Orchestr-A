// Script one-shot pour générer le tableau de counts des 26 templates.
// Usage : pnpm exec tsx backlog/rbac-refactor/contract/_count-templates.mts

import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_KEYS,
} from './contract-02-templates.ts';
import { CATALOG_PERMISSIONS } from './contract-01-atomic-permissions.ts';

console.log(`CATALOG_PERMISSIONS count: ${CATALOG_PERMISSIONS.length}`);
console.log('');
console.log('| Template | Nb permissions |');
console.log('| --- | ---: |');
for (const key of ROLE_TEMPLATE_KEYS) {
  const tpl = ROLE_TEMPLATES[key];
  console.log(`| \`${key}\` | ${tpl.permissions.length} |`);
}
