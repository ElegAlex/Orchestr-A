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
import { timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

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
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      allowedOrigins ||
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
