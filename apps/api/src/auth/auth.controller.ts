import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordTokenDto } from './dto/reset-password-token.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Public } from './decorators/public.decorator';
import { Permissions } from './decorators/permissions.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 20, ttl: 900_000 },
  })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
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
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('register')
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
    medium: { limit: 20, ttl: 900_000 },
  })
  @ApiOperation({ summary: "Inscription d'un nouvel utilisateur" })
  @ApiResponse({
    status: 201,
    description: 'Utilisateur créé avec succès',
  })
  @ApiResponse({
    status: 409,
    description: 'Email ou login déjà utilisé',
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Get('profile')
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Informations utilisateur connecté (version courte)',
  })
  @ApiResponse({
    status: 200,
    description: 'Utilisateur connecté',
  })
  getCurrentUser(@CurrentUser() user: User): User {
    return user;
  }

  @Get('me/permissions')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Permissions de l'utilisateur connecté" })
  @ApiResponse({
    status: 200,
    description: 'Liste des permissions',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  async getMyPermissions(
    @CurrentUser() user: User,
  ): Promise<{ permissions: string[] }> {
    const permissions = await this.authService.getPermissionsForUser(user.role);
    return { permissions };
  }

  @Permissions('users:reset_password')
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
    @CurrentUser() currentUser: User,
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
