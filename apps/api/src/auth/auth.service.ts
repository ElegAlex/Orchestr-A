import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from 'database';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

    // Vérifier que le département existe si fourni
    if (registerDto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: registerDto.departmentId },
      });

      if (!department) {
        throw new BadRequestException('Département introuvable');
      }
    }

    // Vérifier que les services existent si fournis
    if (registerDto.serviceIds && registerDto.serviceIds.length > 0) {
      const services = await this.prisma.service.findMany({
        where: { id: { in: registerDto.serviceIds } },
      });

      if (services.length !== registerDto.serviceIds.length) {
        throw new BadRequestException('Un ou plusieurs services introuvables');
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
        role: registerDto.role || Role.CONTRIBUTEUR,
        departmentId: registerDto.departmentId,
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

    // Créer les associations de services
    if (registerDto.serviceIds && registerDto.serviceIds.length > 0) {
      await this.prisma.userService.createMany({
        data: registerDto.serviceIds.map((serviceId) => ({
          userId: user.id,
          serviceId,
        })),
      });
    }

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
}
