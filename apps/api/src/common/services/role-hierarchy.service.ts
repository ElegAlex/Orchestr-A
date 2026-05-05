import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Hiérarchie par templateKey — un appelant ne peut attribuer (ou cibler dans
 * une opération sensible : reset password, etc.) qu'un rôle dont le template
 * est strictement inférieur au sien. Les templates hors hiérarchie reçoivent
 * le rang 0 par défaut. Seul ADMIN peut viser un autre rôle template ADMIN.
 *
 * Post-V4 : les codes de rôles institutionnels varient d'une collectivité à
 * l'autre (ADMIN_DSI, MANAGER_CFA_FLUX…), seule la templateKey est stable.
 */
@Injectable()
export class RoleHierarchyService {
  readonly TEMPLATE_HIERARCHY: Readonly<Record<string, number>> = {
    BASIC_USER: 1,
    STAGIAIRE_ALTERNANT: 1,
    EXTERNAL_PRESTATAIRE: 1,
    PROJECT_CONTRIBUTOR_LIGHT: 2,
    PROJECT_CONTRIBUTOR: 2,
    IT_SUPPORT: 2,
    FUNCTIONAL_REFERENT: 2,
    DATA_ANALYST: 2,
    HR_OFFICER_LIGHT: 2,
    PROJECT_LEAD_JUNIOR: 3,
    PROJECT_LEAD: 3,
    TECHNICAL_LEAD: 3,
    IT_INFRASTRUCTURE: 3,
    HR_OFFICER: 3,
    CONTROLLER: 3,
    BUDGET_ANALYST: 3,
    THIRD_PARTY_MANAGER: 3,
    OBSERVER_FULL: 3,
    OBSERVER_HR_ONLY: 3,
    OBSERVER_PROJECTS_ONLY: 3,
    MANAGER_PROJECT_FOCUS: 4,
    MANAGER_HR_FOCUS: 4,
    MANAGER: 4,
    PORTFOLIO_MANAGER: 5,
    ADMIN_DELEGATED: 5,
    ADMIN: 6,
  };

  constructor(private readonly prisma: PrismaService) {}

  async resolveTemplateKey(
    code: string | null | undefined,
  ): Promise<string | null> {
    if (!code) return null;
    const role = await this.prisma.role.findUnique({
      where: { code },
      select: { templateKey: true },
    });
    return role?.templateKey ?? null;
  }

  async canAssignRole(
    callerRoleCode: string | null | undefined,
    targetRoleCode: string | null | undefined,
  ): Promise<boolean> {
    const [callerTpl, targetTpl] = await Promise.all([
      this.resolveTemplateKey(callerRoleCode),
      this.resolveTemplateKey(targetRoleCode),
    ]);
    const callerRank = callerTpl
      ? (this.TEMPLATE_HIERARCHY[callerTpl] ?? 0)
      : 0;
    const targetRank = targetTpl
      ? (this.TEMPLATE_HIERARCHY[targetTpl] ?? 0)
      : 0;
    return callerRank > targetRank;
  }

  /**
   * Refuse l'opération si la cible est rattachée au template ADMIN et que
   * l'appelant ne l'est pas, ou si l'appelant n'a pas un rang strictement
   * supérieur. ADMIN siège au sommet : il peut viser n'importe quel rôle.
   * Sans-op si l'un des codes est absent (résolution upstream).
   *
   * Utilisé par : UsersService (create/update/import), AuthService (reset
   * password) — toute opération sensible qui touche au rôle d'autrui.
   */
  async assertCanAssignRole(
    callerRoleCode: string | null | undefined,
    targetRoleCode: string | null | undefined,
  ): Promise<void> {
    if (!callerRoleCode || !targetRoleCode) return;
    const [targetTemplateKey, callerTemplateKey] = await Promise.all([
      this.resolveTemplateKey(targetRoleCode),
      this.resolveTemplateKey(callerRoleCode),
    ]);
    if (targetTemplateKey === 'ADMIN' && callerTemplateKey !== 'ADMIN') {
      throw new ForbiddenException(
        'Seul un administrateur peut cibler un rôle rattaché au template ADMIN',
      );
    }
    if (callerTemplateKey === 'ADMIN') return;
    if (!(await this.canAssignRole(callerRoleCode, targetRoleCode))) {
      throw new ForbiddenException(
        'Vous ne pouvez cibler que des rôles inférieurs au vôtre',
      );
    }
  }
}
