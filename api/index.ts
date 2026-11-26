// Vercel serverless entry: boots the Nest app once per function instance and
// forwards every request to it. Mirrors src/main.ts, minus the steps that need a
// long-lived local process (temp-upload sweep and the DB schema-safety guards).
// Schema changes ship through migrations (npm run migration:run), same as before.
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import {
  createRateLimiter,
  parseCorsOrigins,
  securityHeaders,
} from '../src/common/security';

const server = express();
let booted = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.use(securityHeaders);
  // login/register: 20 tries per 15 minutes for each IP (counted together)
  app.use('/api/user/auth', createRateLimiter(20, 15 * 60 * 1000));
  // unknown fields are rejected, so a typo in the frontend shows up as a clear 400
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  // frontend origin(s) from CORS_ORIGIN (comma separated); defaults to the Angular dev server
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  });
  await app.init();
}

export default async function handler(req: any, res: any) {
  if (!booted) {
    await bootstrap();
    booted = true;
  }
  server(req, res);
}
