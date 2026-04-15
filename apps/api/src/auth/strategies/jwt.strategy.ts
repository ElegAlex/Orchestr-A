import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtBlacklistService } from '../jwt-blacklist.service';

export interface JwtPayload {
  sub: string;
  login: string;
  role: string;
  jti?: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly blacklist: JwtBlacklistService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET must be defined in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.jti && (await this.blacklist.isBlacklisted(payload.jti))) {
      throw new UnauthorizedException('Token révoqué');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        login: true,
        firstName: true,
        lastName: true,
        role: true,
        departmentId: true,
        isActive: true,
        avatarUrl: true,
        avatarPreset: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Utilisateur non autorisé');
    }

    // Attach jti + exp so the controller can blacklist on logout.
    return { ...user, jti: payload.jti, exp: payload.exp };
  }
}
