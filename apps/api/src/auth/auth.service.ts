import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PermissionsService } from '../rbac/permissions.service';
import { AuditService, AuditAction } from '../audit/audit.service';
import { RefreshTokenService, RefreshTokenMeta } from './refresh-token.service';
import { RoleHierarchyService } from '../common/services/role-hierarchy.service';
import { LoginLockoutService } from './login-lockout.service';
import { JwtNotBeforeService } from './jwt-not-before.service';

export interface ResetTokenResponse {
  ok: true;
  /** Présent uniquement si AUTH_EXPOSE_RESET_TOKEN=true (dev/E2E). */
  token?: string;
  /** Présent uniquement si AUTH_EXPOSE_RESET_TOKEN=true (dev/E2E). */
  resetUrl?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly roleHierarchy: RoleHierarchyService,
    private readonly loginLockout: LoginLockoutService,
    private readonly jwtNotBefore: JwtNotBeforeService,
  ) {}

  private getAccessTtl(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_TTL') ||
      this.configService.get<string>('JWT_EXPIRES_IN') ||
      '15m'
    );
  }

  /**
   * Sign a new access token including a jti claim so it can be revoked via blacklist.
   */
  signAccessToken(payload: {
    sub: string;
    login: string;
    role: string | null;
    // SEC-004 — stamped true when the user is flagged `forcePasswordChange`, so
    // the issued session is marked as carrying restricted authority. Omitted
    // (rather than `false`) for the common case to keep tokens minimal.
    mustChangePassword?: boolean;
  }): string {
    const jti = crypto.randomUUID();
    return this.jwtService.sign(
      { ...payload, jti },
      { expiresIn: this.getAccessTtl() as `${number}${'s' | 'm' | 'h' | 'd'}` },
    );
  }

  async validateUser(login: string, password: string) {
    // Accepter login ou email
    let user = await this.prisma.user.findUnique({
      where: { login },
    });

    if (!user && login.includes('@')) {
      user = await this.prisma.user.findUnique({
        where: { email: login },
      });
    }

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    // SEC-005 — a disabled account with otherwise-valid credentials must be
    // indistinguishable from a wrong password / unknown user: same generic 401,
    // same timing (the disabled check runs AFTER bcrypt.compare, so the two
    // failure modes cost the same). Returning null — rather than a distinct
    // `UnauthorizedException('Compte désactivé')` — collapses the differential
    // that let an attacker confirm both account existence AND password validity.
    if (!user.isActive) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto, meta?: RefreshTokenMeta) {
    const ip = meta?.ip;

    // SEC-006 — per-(account, IP) progressive lockout, checked BEFORE credential
    // validation so a locked pair can't keep burning bcrypt comparisons. Only
    // pairs that already crossed the failure threshold land here; the crossing
    // attempt itself still returns the normal 401 below (see recordFailure).
    const lock = await this.loginLockout.isLocked(loginDto.login, ip);
    if (lock.locked) {
      throw new HttpException(
        'Trop de tentatives de connexion. Réessayez plus tard.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.validateUser(loginDto.login, loginDto.password);

    if (!user) {
      // SEC-006 — count this failure; crossing the threshold arms a lock. The
      // CROSSING attempt still returns the generic 401 (the credentials were
      // genuinely wrong); only SUBSEQUENT attempts hit the isLocked guard above
      // and get 429. This keeps the per-IP throttle's "Nth attempt → 429"
      // contract decoupled from the slower cross-window account lockout.
      const failure = await this.loginLockout.recordFailure(loginDto.login, ip);
      if (failure.locked) {
        // AC#4 — auth is audit-sensitive: record the lock with before/after.
        this.auditService.log({
          action: AuditAction.ACCOUNT_LOCKED,
          attemptedEmail: loginDto.login,
          ip,
          ua: meta?.userAgent,
          reason: 'account_locked',
          details: 'Account locked after repeated failed logins',
          before: { locked: false },
          after: {
            locked: true,
            lockSeconds: failure.lockSeconds,
            level: failure.level,
          },
          success: false,
        });
      }

      this.auditService.log({
        action: AuditAction.LOGIN_FAILURE,
        // OBS-001 — the attempted identifier becomes the event subject so an
        // auditor can answer "who was targeted" on a failed login.
        attemptedEmail: loginDto.login,
        ip: meta?.ip,
        ua: meta?.userAgent,
        reason: 'invalid_credentials',
        // SEC-005 — do NOT interpolate the attacker-controlled login into the
        // free-text `details` (persisted in the JSONB payload): that was a log-
        // poisoning / plaintext-disclosure vector. The "who was targeted" subject
        // is still captured — sanitized (lowercased, length-capped, bcrypt-shape
        // refused) — via `attemptedEmail`→`entityId` per OBS-001, which is the
        // right place for it. So `details` carries no identifier at all.
        details: 'Failed login attempt',
        success: false,
      });
      throw new UnauthorizedException('Login ou mot de passe incorrect');
    }

    // SEC-006 — a valid authentication clears all lockout state for this
    // (account, IP) pair: failure counter, any active lock, escalation level.
    await this.loginLockout.clear(loginDto.login, ip);

    // Récupérer les informations complètes de l'utilisateur avec ses services
    const fullUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            templateKey: true,
            isSystem: true,
          },
        },
        departmentId: true,
        avatarUrl: true,
        avatarPreset: true,
        isActive: true,
        // SEC-004 — drives the mustChangePassword token claim below.
        forcePasswordChange: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        userServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        managedServices: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const payload = {
      sub: user.id,
      login: user.login,
      role: fullUser?.role?.code ?? null,
      mustChangePassword: fullUser?.forcePasswordChange ? true : undefined,
    };

    this.auditService.log({
      action: AuditAction.LOGIN_SUCCESS,
      userId: user.id,
      ip: meta?.ip,
      ua: meta?.userAgent,
      // OBS-027 — reference the user by opaque id, never the login (PII), so the
      // immutable trail (and the stdout sink) carries no direct identifier.
      details: `User ${user.id} logged in successfully`,
      success: true,
    });

    const access_token = this.signAccessToken(payload);
    const refresh_token = await this.refreshTokenService.issue(user.id, meta);

    return {
      access_token,
      refresh_token,
      user: fullUser,
    };
  }

  async register(registerDto: RegisterDto) {
    // SEC-008: REGISTRATION_ENABLED gate (default false — disabled in production)
    const registrationEnabled = this.configService.get<string>(
      'REGISTRATION_ENABLED',
    );
    if (!registrationEnabled || registrationEnabled.toLowerCase() !== 'true') {
      throw new ForbiddenException(
        'La création de compte autonome est désactivée',
      );
    }

    // SEC-008: REGISTRATION_EMAIL_DOMAIN allowlist (optional; empty = no restriction)
    const domainAllowlist = this.configService.get<string>(
      'REGISTRATION_EMAIL_DOMAIN',
    );
    if (domainAllowlist && domainAllowlist.trim()) {
      const allowed = domainAllowlist
        .split(',')
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const emailDomain = registerDto.email.split('@')[1]?.toLowerCase() ?? '';
      if (!allowed.includes(emailDomain)) {
        throw new ForbiddenException(
          `Les inscriptions sont réservées aux adresses des domaines autorisés`,
        );
      }
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        // DAT-015: case-insensitive lookup matches the LOWER() unique index
        OR: [
          { email: { equals: registerDto.email, mode: 'insensitive' } },
          { login: { equals: registerDto.login, mode: 'insensitive' } },
        ],
      },
    });

    if (existingUser) {
      // DAT-015: case-fold before comparing
      if (
        existingUser.email.toLowerCase() === registerDto.email.toLowerCase()
      ) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      if (
        existingUser.login.toLowerCase() === registerDto.login.toLowerCase()
      ) {
        throw new ConflictException('Ce login est déjà utilisé');
      }
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    // Résoudre le rôle par défaut depuis la table `roles`. On prend d'abord
    // `isDefault=true`, sinon le code "CONTRIBUTEUR" (template système).
    const defaultRole =
      (await this.prisma.role.findFirst({
        where: { isDefault: true },
        select: { id: true },
      })) ??
      (await this.prisma.role.findUnique({
        where: { code: 'CONTRIBUTEUR' },
        select: { id: true },
      }));
    if (!defaultRole) {
      throw new ConflictException(
        'Aucun rôle par défaut configuré — seed manquant',
      );
    }

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        login: registerDto.login,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        roleId: defaultRole.id,
        // New registrations require admin activation for security
        isActive: false,
      },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            templateKey: true,
          },
        },
        departmentId: true,
        createdAt: true,
      },
    });

    this.auditService.log({
      action: AuditAction.REGISTER,
      userId: user.id,
      details: `New user registered: ${user.id} (pending activation)`, // OBS-027: opaque id, not login
      success: true,
    });

    // No JWT issued — account requires admin activation before login
    return {
      user,
      message:
        'Compte créé. Un administrateur doit activer votre compte avant la connexion.',
    };
  }

  /**
   * Issue a new access token for a given userId (used by /auth/refresh).
   * Re-reads current role/login from DB to prevent stale claims.
   */
  async issueAccessTokenForUser(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        login: true,
        isActive: true,
        // SEC-004 — re-read on refresh so a still-flagged user's refreshed
        // token keeps the restricted-authority claim rather than escaping it.
        forcePasswordChange: true,
        role: { select: { code: true } },
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non autorisé');
    }
    return this.signAccessToken({
      sub: user.id,
      login: user.login,
      role: user.role?.code ?? null,
      mustChangePassword: user.forcePasswordChange ? true : undefined,
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: {
          select: {
            id: true,
            code: true,
            label: true,
            templateKey: true,
            isSystem: true,
          },
        },
        departmentId: true,
        avatarUrl: true,
        avatarPreset: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        userServices: {
          select: {
            service: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable');
    }

    return user;
  }

  async getPermissionsForUser(user: {
    role?: { code: string } | null;
  }): Promise<string[]> {
    const perms = await this.permissionsService.getPermissionsForUser(user);
    return [...perms];
  }

  /**
   * Génère un token de reset password. Deux gardes critiques :
   *
   * 1. Hiérarchie : un appelant ne peut viser que des comptes dont le template
   *    est strictement inférieur au sien (mêmes règles que `users.update`).
   *    Sans cette garde, n'importe quel détenteur de `users:reset_password`
   *    (ex. ADMIN_DELEGATED) pouvait s'auto-promouvoir en réinitialisant le
   *    mot de passe d'un ADMIN. Self-reset (caller==target) → 403 par
   *    construction ; le bon chemin self-service est `/auth/change-password`.
   *
   * 2. Disclosure : le token brut n'est exposé dans la réponse HTTP que si
   *    `AUTH_EXPOSE_RESET_TOKEN=true` (dev / E2E). En prod, l'admin reçoit
   *    `{ ok: true }` ; le canal de transport (mail / SMS) reste à câbler.
   *    On évite délibérément de logger l'URL en clair dans l'audit (qui est
   *    persistée et indexée), seul l'événement est tracé.
   */
  async generateResetToken(
    userId: string,
    createdById: string,
  ): Promise<ResetTokenResponse> {
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, login: true, role: { select: { code: true } } },
    });
    if (!targetUser) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const caller = await this.prisma.user.findUnique({
      where: { id: createdById },
      select: { role: { select: { code: true } } },
    });
    await this.roleHierarchy.assertCanAssignRole(
      caller?.role?.code,
      targetUser.role?.code,
    );

    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // DAT-028: eager GC — remove expired tokens (they can't be used anyway).
    // Uses the @@index([expiresAt]) added in this fix.
    await this.prisma.passwordResetToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token: tokenHash,
        expiresAt,
        createdById,
      },
    });

    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      userId: createdById,
      details: `Password reset token generated for user ${targetUser.id}`, // OBS-027: opaque id, not login
      success: true,
    });

    // SEC-018: never expose token in production, even if flag is true.
    // Flag is only honoured in non-production (dev / E2E).
    const exposeToken =
      this.configService.get<string>('AUTH_EXPOSE_RESET_TOKEN') === 'true' &&
      process.env.NODE_ENV !== 'production';
    if (!exposeToken) {
      return { ok: true };
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4001';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    return { ok: true, token, resetUrl };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Validate the token BEFORE entering the transaction: these checks rely only
    // on the persisted row (not on any write) and produce distinct error messages
    // that the caller depends on. The TOCTOU window that COR-007 targets is the
    // usedAt marking + user.update sequence, not the read-only validation.
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (!resetToken) {
      throw new UnauthorizedException('Token de réinitialisation invalide');
    }

    if (resetToken.usedAt !== null) {
      throw new UnauthorizedException(
        'Ce token de réinitialisation a déjà été utilisé',
      );
    }

    if (resetToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Ce token de réinitialisation a expiré');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    // COR-007 — Wrap the CAS + password update in a serializable transaction to
    // prevent the TOCTOU race where two concurrent requests both pass the read
    // validation above and both proceed to update the user's password.
    //
    // The atomic compare-and-swap uses updateMany with the predicate
    // `usedAt: null`: if another concurrent request already won the race, the
    // DB row will have usedAt≠null and count will be 0 — we throw before
    // touching the user's password. This mirrors the pattern in rotate() in
    // refresh-token.service.ts.
    await this.prisma.$transaction(
      async (tx) => {
        const cas = await tx.passwordResetToken.updateMany({
          where: { token: tokenHash, usedAt: null },
          data: { usedAt: new Date() },
        });

        if (cas.count === 0) {
          // Race lost: another concurrent reset already consumed this token.
          throw new UnauthorizedException(
            'Ce token de réinitialisation a déjà été utilisé',
          );
        }

        await tx.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    // Revoke all refresh tokens so existing sessions are invalidated after password reset
    await this.refreshTokenService.revokeAllForUser(resetToken.userId);

    // SEC-019 — also invalidate already-issued ACCESS tokens. revokeAllForUser
    // only touches refresh tokens; without this bump a stolen access token stays
    // valid until it expires (≤15 min) after the victim resets. Bumping the
    // per-user nbf makes JwtStrategy.validate reject every access token minted
    // before this instant on its next request.
    await this.jwtNotBefore.bumpUser(resetToken.userId);

    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      userId: resetToken.userId,
      details:
        'Password reset via token; all active sessions invalidated (refresh tokens revoked, access tokens invalidated via nbf bump)',
      success: true,
    });
  }
}
