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

    const payload = {
      sub: user.id,
      login: user.login,
      role: user.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        login: user.login,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        departmentId: user.departmentId,
        serviceId: user.serviceId,
      },
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

    // Vérifier que le service existe si fourni
    if (registerDto.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: registerDto.serviceId },
      });

      if (!service) {
        throw new BadRequestException('Service introuvable');
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
        serviceId: registerDto.serviceId,
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
        serviceId: true,
        createdAt: true,
      },
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
        serviceId: true,
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
        service: {
          select: {
            id: true,
            name: true,
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
