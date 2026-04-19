import { SetMetadata } from '@nestjs/common';

/**
 * Marqueur pour les routes self-service de l'allowlist (cf. contract-05 §2).
 *
 * Sous le régime zero-trust (D2 PO), toute route privée doit avoir soit
 * `@Public()`, soit `@RequirePermissions(...)`, soit `@AllowSelfService()`.
 * Ce décorateur signale au PermissionsGuard que la route opère sur les
 * ressources propres de l'utilisateur courant et que le contrôle d'accès
 * fin est délégué au service (typiquement : forçage `userId === currentUser.id`).
 *
 * Liste exhaustive des 26 endpoints concernés : contract-05 §2.
 */
export const ALLOW_SELF_SERVICE_KEY = 'allow_self_service';

export const AllowSelfService = () => SetMetadata(ALLOW_SELF_SERVICE_KEY, true);
