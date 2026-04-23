import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
    private readonly refreshTokenService: RefreshTokenService,
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

    if (!user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto, meta?: RefreshTokenMeta) {
    const user = await this.validateUser(loginDto.login, loginDto.password);

    if (!user) {
      this.auditService.log({
        action: AuditAction.LOGIN_FAILURE,
        details: `Failed login attempt for login: ${loginDto.login}`,
        success: false,
      });
      throw new UnauthorizedException('Login ou mot de passe incorrect');
    }

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
    };

    this.auditService.log({
      action: AuditAction.LOGIN_SUCCESS,
      userId: user.id,
      details: `User ${user.login} logged in successfully`,
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
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: registerDto.email }, { login: registerDto.login }],
      },
    });

    if (existingUser) {
      if (existingUser.email === registerDto.email) {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      if (existingUser.login === registerDto.login) {
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
      details: `New user registered: ${user.login} (pending activation)`,
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

  async generateResetToken(
    userId: string,
    createdById: string,
  ): Promise<{ token: string; resetUrl: string }> {
    // Vérifier que l'utilisateur cible existe
    const targetUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Invalider les tokens précédents pour ce user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Générer un nouveau token
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24h

    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
        createdById,
      },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4001';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      userId: createdById,
      details: `Password reset token generated for user ${targetUser.login}`,
      success: true,
    });

    return { token, resetUrl };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token },
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

    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await this.prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    // Revoke all refresh tokens so existing sessions are invalidated after password reset
    await this.refreshTokenService.revokeAllForUser(resetToken.userId);

    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      userId: resetToken.userId,
      details: 'Password reset via token',
      success: true,
    });
  }
}
