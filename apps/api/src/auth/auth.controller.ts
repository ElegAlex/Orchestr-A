import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuditService, AuditAction } from '../audit/audit.service';
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
import { clientIp } from '../common/fastify/trust-proxy.config';

type RequestMeta = { userAgent?: string; ip?: string };
// SEC-014 — refresh-token cookie hardening.
// Production uses the __Host- prefix, which the browser only accepts with
// Secure + Path=/ + no Domain — closing the shared-domain / sibling-subdomain
// plant-or-read vector and (via SameSite=Strict) top-level-nav CSRF.
// http://localhost (dev + e2e) cannot carry Secure cookies, so dev/test fall
// back to the non-prefixed name. The read path resolves BOTH names so existing
// production sessions (legacy name, Path=/api/auth) survive the rename until
// their refresh cookie next rotates — see deploy note / SEC-014 transition.
const REFRESH_COOKIE_LEGACY = 'orchestr_a_refresh_token';
const REFRESH_COOKIE_HOST = `__Host-${REFRESH_COOKIE_LEGACY}`;

function isProdCookie(): boolean {
  return process.env.NODE_ENV === 'production';
}

function refreshCookieName(): string {
  return isProdCookie() ? REFRESH_COOKIE_HOST : REFRESH_COOKIE_LEGACY;
}

function extractMeta(req: {
  headers?: Record<string, unknown>;
  ip?: string;
}): RequestMeta {
  const userAgentRaw = req.headers?.['user-agent'];
  const userAgent =
    typeof userAgentRaw === 'string' ? userAgentRaw.slice(0, 512) : undefined;
  // SEC-013: real client IP (req.ip = leftmost untrusted hop under
  // Fastify+trustProxy), not req.ips[0] (the nginx socket). Drives the SEC-006
  // (account, IP) lockout key and the refresh-token audit IP.
  const ip = clientIp(req);
  return { userAgent, ip };
}

function cookieValue(req: { headers?: Record<string, unknown> }, name: string) {
  const raw = req.headers?.cookie;
  if (typeof raw !== 'string') return undefined;
  const prefix = `${name}=`;
  return raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

// @fastify/cookie is NOT registered in this app, so the fix keeps the raw
// Set-Cookie construction (registering it would touch main.ts + package.json
// for no security gain); a correctly-built header is standards-compliant.
function buildRefreshCookie(value: string, maxAge: number): string {
  const prod = isProdCookie();
  const attrs = [
    `${refreshCookieName()}=${value}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (prod) attrs.push('Secure');
  return attrs.join('; ');
}

function setRefreshCookie(
  reply: FastifyReply | undefined,
  refreshToken: string,
  maxAge: number,
) {
  reply?.header(
    'Set-Cookie',
    buildRefreshCookie(encodeURIComponent(refreshToken), maxAge),
  );
}

function clearRefreshCookie(reply: FastifyReply | undefined) {
  reply?.header('Set-Cookie', buildRefreshCookie('', 0));
}

// Dual-name read for the SEC-014 rename transition: prefer the production
// __Host- name, fall back to the legacy/dev name. Safe in every env — the
// __Host- name simply won't be present in dev. Remove the legacy fallback once
// one JWT_REFRESH_TTL window (7d default) has elapsed post-deploy.
function readRefreshCookie(req: {
  headers?: Record<string, unknown>;
}): string | undefined {
  return (
    cookieValue(req, REFRESH_COOKIE_HOST) ??
    cookieValue(req, REFRESH_COOKIE_LEGACY)
  );
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly blacklist: JwtBlacklistService,
  ) {}

  @Public()
  @Post('login')
  // SEC-006 — IP burst cut 30→5/min so a single IP can't brute-force at speed;
  // the longer-window cap (120/15min) stays as a sane sustained bound. This is
  // the outer, per-IP bound; the per-(account, IP) progressive lockout
  // (LoginLockoutService) is the precision layer behind it. Shared-NAT note:
  // 5/min is per source IP, so a busy office behind one NAT shares the bucket —
  // an accepted operator tradeoff (see SEC-006 Learnings).
  @Throttle({
    short: { limit: 5, ttl: 60_000 },
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
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const result = await this.authService.login(loginDto, extractMeta(req));
    setRefreshCookie(
      reply,
      result.refresh_token,
      this.refreshTokenService.getCookieMaxAgeSeconds(),
    );
    return { access_token: result.access_token, user: result.user };
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
    description:
      'Nouveau access_token; refresh token renouvelé en cookie HttpOnly',
  })
  @ApiResponse({ status: 401, description: 'Refresh token invalide ou expiré' })
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ) {
    const refreshToken = body.refreshToken ?? readRefreshCookie(req) ?? '';
    const { userId, newRefreshToken } = await this.refreshTokenService.rotate(
      refreshToken,
      extractMeta(req),
    );
    const access_token = await this.authService.issueAccessTokenForUser(userId);
    setRefreshCookie(
      reply,
      newRefreshToken,
      this.refreshTokenService.getCookieMaxAgeSeconds(),
    );
    return { access_token };
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
    @Req() req: any,
    @Res({ passthrough: true }) reply?: FastifyReply,
  ): Promise<void> {
    // Durable, Redis-independent revocations first (Postgres + response cookie) so a Redis
    // outage cannot skip them. The jti blacklist runs last because it is the only
    // Redis-dependent step: on Redis failure it throws 503 (SEC-021, fail-closed), after
    // the refresh token is already revoked, so the client retries an idempotent op rather
    // than receiving a false 204.
    const refreshToken =
      body?.refreshToken ?? readRefreshCookie(req) ?? undefined;
    if (refreshToken) {
      await this.refreshTokenService.revoke(refreshToken);
    }
    clearRefreshCookie(reply);
    if (user.jti && user.exp) {
      const remaining = user.exp - Math.floor(Date.now() / 1000);
      if (remaining > 0) {
        await this.blacklist.blacklist(user.jti, remaining);
      }
    }

    // OBS-003 — durable audit trail for session termination, symmetric with the
    // LOGIN_SUCCESS emit. Fire-and-forget (AuditService.log), so a Redis/DB audit
    // failure never turns a completed logout into an error. Subject = the user
    // whose session ended; reference by opaque id only (OBS-027), no PII.
    const uaRaw = req?.headers?.['user-agent'];
    this.auditService.log({
      action: AuditAction.LOGOUT,
      userId: user.id,
      ip: clientIp(req),
      ua: typeof uaRaw === 'string' ? uaRaw.slice(0, 512) : undefined,
      details: `User ${user.id} logged out`,
      success: true,
    });
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
    description:
      'Token généré. `token` et `resetUrl` ne sont retournés que si AUTH_EXPOSE_RESET_TOKEN=true (dev/E2E) ; sinon la réponse est { ok: true } et le canal de délivrance (mail/SMS) prend le relais.',
    schema: {
      example: {
        ok: true,
        token: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        resetUrl: 'http://localhost:4001/reset-password?token=...',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({
    status: 403,
    description:
      'Permission insuffisante OU appelant sans rang strictement supérieur à la cible (incl. self-reset)',
  })
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
