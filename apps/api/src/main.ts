import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@event-platform/shared';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.module';
import { parseCorsOrigins } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<AppConfigService>(ConfigService);

  // Swagger UI ships inline scripts, so a strict CSP is only enforced in production.
  app.use(
    helmet({
      contentSecurityPolicy:
        config.get('NODE_ENV', { infer: true }) === 'production' ? undefined : false,
    }),
  );
  app.use(cookieParser());

  // The local storage provider writes uploads to disk; the same process serves them so
  // logos and banners are visible without a separate web server.
  if (config.get('STORAGE_PROVIDER', { infer: true }) === 'local') {
    app.useStaticAssets(join(process.cwd(), config.get('LOCAL_STORAGE_DIR', { infer: true })), {
      prefix: '/static/',
      index: false,
      redirect: false,
    });
  }

  // Behind a load balancer, use the forwarded client address for per-IP rate limits.
  // The hop count is explicit so a client cannot spoof it by sending its own header.
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxy);
  }

  app.enableCors({
    origin: parseCorsOrigins(config.get('CORS_ORIGINS', { infer: true })),
    credentials: true,
  });

  app.setGlobalPrefix(API_PREFIX);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Event Platform API')
        .setDescription(
          'Multi-tenant, white-label event management. All tenant context is derived ' +
            'server-side from verified membership.',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  Logger.log(
    `API listening on http://localhost:${port}/${API_PREFIX}/v1`,
    'Bootstrap',
  );
}

void bootstrap();
