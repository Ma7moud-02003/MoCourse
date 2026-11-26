import { sweepOldTempUploads } from './common/upload/temp-upload';
import { assertCertificateSchemaSafety } from './database/certificate-sync-guard';
import { assertEnrollmentSchemaSafety } from './database/enrollment-sync-guard';
import { assertPurchaseSchemaSafety } from './database/purchase-sync-guard';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { createRateLimiter, parseCorsOrigins, securityHeaders } from './common/security';

async function bootstrap() {
  await sweepOldTempUploads();
  await assertCertificateSchemaSafety();
  await assertEnrollmentSchemaSafety();
  await assertPurchaseSchemaSafety();
  const app = await NestFactory.create(AppModule);
  app.use(securityHeaders);
  // login/register: 20 tries per 15 minutes for each IP (counted together)
  app.use('/api/user/auth', createRateLimiter(20, 15 * 60 * 1000));
  // unknown fields are rejected, so a typo in the frontend shows up as a clear 400
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  // frontend origin(s) from CORS_ORIGIN (comma separated); defaults to the Angular dev server
  app.enableCors({
    origin: parseCorsOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
