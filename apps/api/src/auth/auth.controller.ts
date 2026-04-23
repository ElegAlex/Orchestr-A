import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtBlacklistService } from './jwt-blacklist.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordTokenDto } from './dto/reset-password-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto, LogoutDto } from './dto/refresh-token.dto';
import { Public } from './decorators/public.decorator';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { AllowSelfService } from '../rbac/decorators/allow-self-service.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthenticatedUser } from './decorators/current-user.decorator';

type RequestMeta = { userAgent?: string; ip?: string };

function extractMeta(req: {
  headers?: Record<string, unknown>;
  ip?: string;
  ips?: string[];
}): RequestMeta {
  const userAgentRaw = req.headers?.['user-agent'];
  const userAgent =
    typeof userAgentRaw === 'string' ? userAgentRaw.slice(0, 512) : undefined;
  const ip = req.ips?.length ? req.ips[0] : (req.ip ?? undefined);
  return { userAgent, ip };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly blacklist: JwtBlacklistService,
  ) {}

  @Public()
  @Post('login')
  @Throttle({
    short: { limit: 30, ttl: 60_000 },
    medium: { limit: 120, ttl: 900_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'opaque-48-byte-base64url-token',
        user: {
          id: 'uuid',
          email: 'admin@orchestr-a.internal',
          login: 'admin',
          firstName: 'Admin',
          lastName: 'System',
          role: 'ADMIN',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Login ou mot de passe incorrect' })
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    return this.authService.login(loginDto, extractMeta(req));
  }

  @Public()
  @Post('refresh')
  @Throttle({
    short: { limit: 30, ttl: 60_000 },
    medium: { limit: 120, ttl: 900_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Rafraîchir le token d'accès" })
  @ApiResponse({
    status: 200,
    description: 'Nouveau access_token + refresh_token',
  })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expiré' })
  async refresh(@Body() body: RefreshTokenDto, @Req() req: any) {
    const { userId, newRefreshToken } = await this.refreshTokenService.rotate(
      body.refreshToken,
      extractMeta(req),
    );
    const access_token = await this.authService.issueAccessTokenForUser(userId);
    return { access_token, refresh_token: newRefreshToken };
  }

  @Post('logout')
  @AllowSelfService()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Déconnexion — blacklist du JWT et révocation du refresh token',
  })
  @ApiResponse({ status: 204, description: 'Déconnexion effectuée' })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async logout(
    @Body() body: LogoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (user.jti && user.exp) {
      const remaining = user.exp - Math.floor(Date.now() / 1000);
      if (remaining > 0) {
        await this.blacklist.blacklist(user.jti, remaining);
      }
    }
    if (body?.refreshToken) {
      await this.refreshTokenService.revoke(body.refreshToken);
    }
  }

  @Public()
  @Post('register')
  @Throttle({
    short: { limit: 30, ttl: 60_000 },
    medium: { limit: 120, ttl: 900_000 },
  })
  @ApiOperation({
    summary:
      "Inscription d'un nouvel utilisateur (compte inactif, nécessite activation admin)",
  })
  @ApiResponse({
    status: 201,
    description:
      'Utilisateur créé (inactif). Un administrateur doit activer le compte avant la connexion.',
  })
  @ApiResponse({
    status: 409,
    description: 'Email ou login déjà utilisé',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('profile')
  @AllowSelfService()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Récupérer le profil de l'utilisateur connecté" })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur',
  })
  @ApiResponse({
    status: 401,
    description: 'Non autorisé',
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.authService.getProfile(userId);
  }

  @Get('me')
  @AllowSelfService()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Informations utilisateur connecté (version courte)',
  })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur connecté',
  })
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  @Get('me/permissions')
  @AllowSelfService()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Permissions de l'utilisateur connecté" })
  @ApiResponse({
    status: 200,
    description: 'Liste des permissions',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async getMyPermissions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ permissions: string[] }> {
    const permissions = await this.authService.getPermissionsForUser(user);
    return { permissions };
  }

  @RequirePermissions('users:reset_password')
  @Post('reset-password-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Générer un token de réinitialisation de mot de passe (admin)',
  })
  @ApiResponse({
    status: 201,
    description: 'Token généré',
    schema: {
      example: {
        token: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        resetUrl: 'http://localhost:4001/reset-password?token=...',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Permission insuffisante' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async generateResetToken(
    @Body() dto: ResetPasswordTokenDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.authService.generateResetToken(dto.userId, currentUser.id);
  }

  @Public()
  @Post('reset-password')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 20, ttl: 900_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe via token (public)' })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe mis à jour avec succès',
  })
  @ApiResponse({
    status: 401,
    description: 'Token invalide, expiré ou déjà utilisé',
  })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Mot de passe mis à jour avec succès' };
  }
}
