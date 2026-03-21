import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
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
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { User } from '@prisma/client';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @Throttle({
    short: { ttl: 60000, limit: 5 },
    medium: { ttl: 900000, limit: 15 },
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
    short: { ttl: 60000, limit: 3 },
    medium: { ttl: 900000, limit: 10 },
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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

  @UseGuards(JwtAuthGuard)
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
}
