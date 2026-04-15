import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join } from 'path';
import { fastifyLoggerOptions } from './common/fastify/redact.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: fastifyLoggerOptions }),
  );

  // Multipart (file uploads)
  await app.register(fastifyMultipart as Parameters<typeof app.register>[0], {
    limits: { fileSize: 2 * 1024 * 1024 },
  });

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

  // CORS
  app.enableCors({
    origin:
      process.env.ALLOWED_ORIGINS?.split(',') ||
      (process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:4001', 'http://localhost:3000']),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global prefix
  app.setGlobalPrefix('api');

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
      logger.warn(
        '[SECURITY WARNING] Swagger UI is enabled in production — ensure it is protected.',
      );
    }

    // SEC-01: basic-auth hook placeholder — requires Fastify scope/prefix wiring.
    // When SWAGGER_USER and SWAGGER_PASS are both set, /api/docs should be
    // protected via @fastify/basic-auth registered BEFORE SwaggerModule.setup
    // and applied to the api/docs route. Dependency not yet added; the prod
    // warning banner above is the minimum safeguard until then.
    if (process.env.SWAGGER_USER && process.env.SWAGGER_PASS) {
      logger.warn(
        '[SEC-01] SWAGGER_USER/SWAGGER_PASS are set but basic-auth wiring is not yet implemented. Protect /api/docs at the reverse proxy layer.',
      );
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

  console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🚀 ORCHESTR'A V2 API                                   ║
  ║                                                           ║
  ║   📡 API Server: http://localhost:${port}/api                ║
  ║   📚 Swagger Docs: http://localhost:${port}/api/docs         ║
  ║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                    ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
  `);
}

void bootstrap();
