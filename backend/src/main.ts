import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from './app.module';
import { isSupabaseDirectUrl, poolerCandidates } from './common/supabase-db-url';

/**
 * Ensure the runtime uses the same IPv4 Session-pooler URL the deploy step
 * resolved (see scripts/db-deploy.cjs). Falls back to a best-effort transform
 * if the resolved file is missing. Must run before Prisma connects.
 */
function resolveDatabaseUrl(): void {
  const resolvedPath = path.join(os.tmpdir(), 'veloria-resolved-db-url');
  try {
    if (fs.existsSync(resolvedPath)) {
      const url = fs.readFileSync(resolvedPath, 'utf8').trim();
      if (url) {
        process.env.DATABASE_URL = url;
        return;
      }
    }
  } catch {
    /* ignore */
  }
  const raw = process.env.DATABASE_URL ?? '';
  if (isSupabaseDirectUrl(raw)) {
    process.env.DATABASE_URL = poolerCandidates(raw)[0];
  }
}

async function bootstrap(): Promise<void> {
  resolveDatabaseUrl();
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const corsOrigins = config.get<string[]>('corsOrigins') ?? ['http://localhost:5173'];

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port);
  logger.log(`VELORIA backend listening on http://localhost:${port}/api`);
}

void bootstrap();
