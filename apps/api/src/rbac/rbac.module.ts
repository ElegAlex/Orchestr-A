import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsService } from './permissions.service';
import { PermissionsGuardV2 } from './permissions.guard';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * RbacModule — V1 C de Spec 2.
 *
 * Expose `PermissionsService` (résolution role → permissions via templates).
 * Annoté `@Global()` pour permettre injection depuis tous les modules sans
 * import explicite — pattern aligné sur `CommonModule`.
 *
 * Dépendances :
 *  - `PrismaModule` (lecture table `roles`).
 *  - `ConfigModule` (REDIS_*).
 *
 * Note V1 : `PermissionsGuardV2` est créé ici mais N'EST PAS enregistré
 * comme `APP_GUARD`. L'ancien `PermissionsGuard` legacy continue de gérer
 * les checks RBAC. L'activation globale du guard zero-trust se fait en
 * V2 (E.a → mode permissive, puis V2 (E.i) → mode enforce).
 *
 * Le RolesController/RolesService (V1 D) sont ajoutés ci-dessous.
 */
@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [RolesController],
  providers: [
    PermissionsService,
    PermissionsGuardV2,
    RolesService,
    // V2 E (a) : activation globale du guard zero-trust en mode `permissive`
    // par défaut (env RBAC_GUARD_MODE=permissive). Le guard logue les routes
    // qui SERAIENT refusées sans bloquer. La bascule en `enforce` se fait
    // via env RBAC_GUARD_MODE=enforce après validation de l'absence de
    // route oubliée (logs propres en V3).
    {
      provide: APP_GUARD,
      useClass: PermissionsGuardV2,
    },
  ],
  exports: [PermissionsService, PermissionsGuardV2, RolesService],
})
export class RbacModule {}
