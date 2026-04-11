# Dette technique — duplication des données démo du seed

**Statut** : ouvert
**Identifié le** : 2026-04-11 (Wave 1 checkpoint, feature tiers)
**Priorité** : moyenne (bug dormant, pas de fuite observée en prod mais bloque tout `db:seed` répété sur une instance)

## Symptôme

Lancer `pnpm --filter database run db:seed` plusieurs fois sur la même base crée ~50 entités en double à chaque run :

| Entité | Comptage après 10 runs locaux | Cible idempotente |
|---|---|---|
| `projects` ("Projet de test") | 10 | 1 |
| `milestones` ("Audit & Cadrage terminé") | 10 | 1 |
| `milestones` ("Cahier des charges validé") | 4 | 1 |
| `tasks` | 393 | ~35–40 |

## Causes précises dans `packages/database/prisma/seed.ts`

Toutes non-guardées (`prisma.X.create` directs sans `findFirst` préalable ni `upsert`) :

- L.394 : `prisma.project.create({ name: "Projet de test", ... })`
- L.478-519 : 4 `prisma.milestone.create` pour Migration SI — **hors du bloc `if (!migrationProject)`**
- L.627-784 : `prisma.milestone.create` pour "Projet de test" et les 5 extra projects
- L.799 : `prisma.task.create` dans une boucle de 30 tâches Migration SI
- L.815-836 : 3 `prisma.epic.create`
- L.1283 : `prisma.task.create` additionnel

Les blocs **idempotents** (à ne PAS toucher) : admin user, departments, services, 15 employees, project members (upsert), 5 extra projects (upsert avec IDs fixes), permissions, RoleConfig, leaveTypeConfig, teleworkSchedule, bloc E2E seed complet.

## Workaround actif (Wave 1.5)

Extraction de la partie RBAC dans `seedPermissionsAndRoles()` + entry point dédié `seed-permissions.ts` (commande `pnpm --filter database run db:seed:permissions`). Permet de mettre à jour les permissions/rôles en prod sans re-déclencher la duplication des données démo.

**Ne résout pas le bug sous-jacent** — `db:seed` complet reste non-idempotent.

## Options pour la résolution définitive

Questions à trancher avant de fixer :

1. **Les données démo doivent-elles exister en prod ?** Si non, ajouter un guard `if (process.env.SEED_DEMO_DATA === "true")` autour de tous les blocs démo et n'exécuter que sur environnements de dev/staging.
2. **Si oui en prod** : migrer vers des IDs fixes (pattern `00000000-0000-0000-0000-0000000000XX`) et utiliser `upsert` partout. C'est déjà le pattern des 5 extra projects (L.528-612). À appliquer uniformément.
3. **Ou intermédiaire** : `findFirst` guard sur le nom unique de chaque entité avant le `create`, comme c'est déjà fait pour `migrationProject` et les projets E2E. Moins invasif mais duplique de la logique.

## Impact si non traité

- Tout déploiement prod via `db:seed` full = explosion quantité données démo
- Les stats/dashboards affichent des données gonflées
- Les rapports d'analytics deviennent inexploitables
- Les tests e2e qui comptent des entités peuvent osciller entre runs

## À faire pour démarrer la résolution

- [ ] Décider (1/2/3 ci-dessus) avec l'équipe produit
- [ ] Nettoyer les bases locales impactées (`DELETE WHERE name IN (...)` ou reset complet)
- [ ] Auditer les bases VPS staging pour estimer l'ampleur
- [ ] Appliquer le fix choisi dans un commit dédié `fix(seed): make demo-data blocks idempotent`
- [ ] Fermer ce ticket
