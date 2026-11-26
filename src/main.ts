import { sweepOldTempUploads } from './common/upload/temp-upload';
import { assertCertificateSchemaSafety } from './database/certificate-sync-guard';
import { assertEnrollmentSchemaSafety } from './database/enrollment-sync-guard';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {  ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  await sweepOldTempUploads();
  await assertCertificateSchemaSafety();
  await assertEnrollmentSchemaSafety();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe())
    app.enableCors({
    origin: 'http://localhost:4200',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
