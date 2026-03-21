import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from 'database';
import { RoleManagementService } from '../role-management/role-management.service';
import { AuditService, AuditAction } from '../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly roleManagementService: RoleManagementService,
    private readonly auditService: AuditService,
  ) {}

  async validateUser(login: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { login },
    });

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

  async login(loginDto: LoginDto) {
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
        role: true,
        departmentId: true,
        avatarUrl: true,
        avatarPreset: true,
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
      role: user.role,
    };

    this.auditService.log({
      action: AuditAction.LOGIN_SUCCESS,
      userId: user.id,
      details: `User ${user.login} logged in successfully`,
      success: true,
    });

    return {
      access_token: this.jwtService.sign(payload),
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

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        login: registerDto.login,
        passwordHash,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: Role.CONTRIBUTEUR,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
        createdAt: true,
      },
    });

    this.auditService.log({
      action: AuditAction.REGISTER,
      userId: user.id,
      details: `New user registered: ${user.login}`,
      success: true,
    });

    // Générer un token JWT
    const payload = {
      sub: user.id,
      login: user.login,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
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
        role: true,
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

  async getPermissionsForUser(role: string): Promise<string[]> {
    if (role === 'ADMIN') {
      const allPermissions = await this.prisma.permission.findMany();
      return allPermissions.map((p) => p.code);
    }
    return this.roleManagementService.getPermissionsForRole(role);
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

    this.auditService.log({
      action: AuditAction.PASSWORD_CHANGED,
      userId: resetToken.userId,
      details: 'Password reset via token',
      success: true,
    });
  }
}
