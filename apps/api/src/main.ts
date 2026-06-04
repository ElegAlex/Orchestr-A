import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { fastifyLoggerOptions } from './common/fastify/redact.config';
import { TRUST_PROXY } from './common/fastify/trust-proxy.config';
import { genReqId, requestIdStore } from './common/fastify/request-id.context';
import { timingSafeEqual } from 'crypto';
import {
  NoopErrorReporter,
  installGlobalErrorHandlers,
} from './common/error-reporter';
import { resolveAllowedOrigins } from './common/fastify/cors.config';
import { assertJwtSecretStrength } from './common/config/jwt-secret';
import { JwtService } from '@nestjs/jwt';
import { createUploadsAuthHook } from './common/fastify/uploads-auth.hook';

// OBS-010: install process-level error handlers before the app boots so that
// unhandledRejection and uncaughtException are captured from the very first tick.
// NoopErrorReporter logs to stdout only; replace with a DSN-configured reporter
// when an operator-approved tracking backend (Sentry, GlitchTip …) is set up.
installGlobalErrorHandlers(new NoopErrorReporter());

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // SEC-001: refuse to start in production if the RBAC guard is in
  // permissive mode. Permissive allows any authenticated user to hit
  // controller methods that lack an RBAC decorator (only a warning is
  // logged). The guard now defaults to 'enforce'; an explicit
  // RBAC_GUARD_MODE=permissive must be opted-in for staging/migration only.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.RBAC_GUARD_MODE === 'permissive'
  ) {
    throw new Error(
      "RBAC_GUARD_MODE='permissive' is forbidden in production " +
        '(routes without @RequirePermissions/@AllowSelfService/@Public ' +
        'would be silently allowed). Unset the variable or set it to ' +
        "'enforce'.",
    );
  }

  // SEC-026: refuse to start in production if JWT_SECRET is shorter than 32
  // characters. A weak or absent secret allows token forgery. The check is
  // prod-only so test/dev short secrets (e.g. 'test-secret') are unaffected.
  assertJwtSecretStrength(process.env.JWT_SECRET, process.env.NODE_ENV);

  // SEC-018: refuse to start in production if AUTH_EXPOSE_RESET_TOKEN=true.
  // The flag returns the raw reset token in the HTTP response (dev/E2E only).
  // Shipping it to production would expose tokens via logs, proxies, and
  // browser dev-tools.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.AUTH_EXPOSE_RESET_TOKEN === 'true'
  ) {
    throw new Error(
      "AUTH_EXPOSE_RESET_TOKEN='true' is forbidden in production " +
        '(reset tokens would be returned in the HTTP response body). ' +
        "Unset the variable or set it to 'false'.",
    );
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // SEC-013: trust the nginx hop on the internal docker network so req.ip is
    // the real client behind the proxy (drives per-client throttle/lockout/audit).
    // OBS-009: genReqId honours x-request-id header (sanitised) or generates a
    // fresh UUID v4 so every request has a stable correlation id.
    new FastifyAdapter({
      logger: fastifyLoggerOptions,
      trustProxy: [...TRUST_PROXY],
      genReqId,
      // SEC-025: explicit bodyLimit (1 MiB) prevents unbounded JSON bodies from
      // exhausting memory before the ValidationPipe can reject them.
      bodyLimit: 1048576,
    }),
  );

  // OBS-009: bind the request id into AsyncLocalStorage so any service can call
  // getRequestId() to thread correlation without parameter-passing.
  // enterWith() is used (not run()) so the store persists across the full async
  // chain spawned from this hook, including NestJS interceptors and services.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', (request, _reply, done) => {
      requestIdStore.enterWith({ requestId: request.id });
      done();
    });

  // Multipart (file uploads)
  await app.register(fastifyMultipart as Parameters<typeof app.register>[0], {
    limits: { fileSize: 2 * 1024 * 1024 },
  });

  // SEC-016: @fastify/static below serves /api/uploads/* as raw Fastify routes
  // that bypass Nest's global guards. Register an onRequest auth hook FIRST so
  // every uploads request must carry a valid Bearer access token (closes the
  // anonymous GET = 200 hole). See uploads-auth.hook.ts for the scope rationale.
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onRequest', createUploadsAuthHook(app.get(JwtService)));

  // Static files (avatars uploads)
  await app.register(fastifyStatic as Parameters<typeof app.register>[0], {
    root: join(process.cwd(), 'uploads'),
    prefix: '/api/uploads/',
  });

  // Security headers (@fastify/helmet)
  await app.register(helmet as Parameters<typeof app.register>[0], {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
      },
    },
  });

  // CORS — SEC-012: resolved via cors.config.ts (CORS_ORIGIN canonical, ALLOWED_ORIGINS alias)
  app.enableCors({
    origin: resolveAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // OBS-017: global exception filter — masks non-HttpException errors to safe
  // { statusCode, message, timestamp, path } shape, logs full detail server-side.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger documentation (only if enabled)
  if (process.env.SWAGGER_ENABLED === 'true') {
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.SWAGGER_USER || !process.env.SWAGGER_PASS) {
        throw new Error(
          'SWAGGER_USER and SWAGGER_PASS are required when Swagger is enabled in production',
        );
      }
      logger.warn(
        '[SECURITY WARNING] Swagger UI is enabled in production — ensure it is protected.',
      );
    }

    // SEC-01: Protect Swagger with HTTP Basic Auth when credentials are configured
    if (process.env.SWAGGER_USER && process.env.SWAGGER_PASS) {
      const swaggerUser = process.env.SWAGGER_USER;
      const swaggerPass = process.env.SWAGGER_PASS;
      app
        .getHttpAdapter()
        .getInstance()
        .addHook('onRequest', (request, reply, done) => {
          if (request.url?.startsWith('/api/docs')) {
            const auth = request.headers.authorization;
            if (!auth || !auth.startsWith('Basic ')) {
              reply.header('WWW-Authenticate', 'Basic realm="Swagger"');
              reply.code(401).send('Unauthorized');
              return;
            }
            const [user, pass] = Buffer.from(auth.slice(6), 'base64')
              .toString()
              .split(':');
            if (
              !safeEqual(user, swaggerUser) ||
              !safeEqual(pass, swaggerPass)
            ) {
              reply.code(401).send('Unauthorized');
              return;
            }
          }
          done();
        });
      logger.log('Swagger Basic Auth protection enabled');
    }

    const config = new DocumentBuilder()
      .setTitle("ORCHESTR'A V2 API")
      .setDescription(
        'API de gestion de projets et de ressources humaines pour collectivités territoriales',
      )
      .setVersion('2.0.0')
      .addBearerAuth()
      .addTag('auth', 'Authentification')
      .addTag('users', 'Gestion des utilisateurs')
      .addTag('projects', 'Gestion des projets')
      .addTag('tasks', 'Gestion des tâches')
      .addTag('leaves', 'Gestion des congés')
      .addTag('telework', 'Gestion du télétravail')
      .addTag('skills', 'Gestion des compétences')
      .addTag('time-tracking', 'Suivi du temps')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('📚 Swagger documentation enabled');
  }

  const port = process.env.API_PORT || process.env.PORT || 4000;
  await app.listen(port, '0.0.0.0');

  logger.log(
    `ORCHESTR'A V2 API listening on port ${port} [${process.env.NODE_ENV || 'development'}]`,
  );
  logger.log(`API: http://localhost:${port}/api`);
}

void bootstrap();
