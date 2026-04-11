# Rollback — migration `20260411100717_add_third_parties_and_time_entry_actor_xor`

**Contexte** : Prisma ne gère pas de migration descendante native. Ce document décrit la procédure manuelle à exécuter dans une transaction unique pour revenir à l'état antérieur à la migration.

**Préalable impératif** : aucune `TimeEntry` avec `userId = NULL` ne doit exister. Sinon, la remise en `NOT NULL` de `userId` échouera. Dans ce cas, décider quoi faire des entries tiers orphelines AVANT de lancer le rollback (delete, réattribution à un user "system", etc.).

## Procédure

```sql
BEGIN;

-- 1. Supprimer la contrainte XOR et les FK nouvelles
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_actor_xor_check";
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_declaredById_fkey";
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_thirdPartyId_fkey";

-- 2. Supprimer les colonnes nouvelles (les indexes associés tombent avec)
ALTER TABLE "time_entries" DROP COLUMN "thirdPartyId";
ALTER TABLE "time_entries" DROP COLUMN "declaredById";

-- 3. Restaurer userId NOT NULL
-- Ne fonctionnera QUE si aucune entry n'a userId NULL
ALTER TABLE "time_entries" ALTER COLUMN "userId" SET NOT NULL;

-- 4. Supprimer les tables tiers (CASCADE pour les FK dépendantes)
DROP TABLE "project_third_party_members";
DROP TABLE "task_third_party_assignees";
DROP TABLE "third_parties";

-- 5. Supprimer l'enum
DROP TYPE "ThirdPartyType";

-- 6. Supprimer l'enregistrement de la migration pour que Prisma ne la considère plus appliquée
DELETE FROM "_prisma_migrations"
  WHERE migration_name = '20260411100717_add_third_parties_and_time_entry_actor_xor';

COMMIT;
```

## Après rollback

1. Revenir sur la version du code précédant la feature (git revert ou checkout sur le commit avant la migration).
2. `pnpm --filter database db:generate` pour régénérer le client Prisma sur l'ancien schema.
3. Flush du cache Redis RBAC : `redis-cli DEL "role-permissions:*"` (les permissions tiers ajoutées au seed ne seront plus référencées mais le cache peut encore en contenir).
4. Redémarrer l'API.

## Rappel opérationnel

- **Jamais** exécuter ce rollback sans backup préalable de la base.
- **Jamais** exécuter ce rollback si des time entries tiers ont été créées en prod (elles seront perdues — seul un backup permet de les préserver).
