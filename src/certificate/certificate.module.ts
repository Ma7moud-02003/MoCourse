import { Module } from '@nestjs/common';
import { CertificateController } from './certificate.controller';
import { CertificateService } from './certificate.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateEntity } from './certificate.entity';
import { CommonModule } from 'src/common/common.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports:[TypeOrmModule.forFeature([CertificateEntity]),CommonModule,NotificationsModule],
  controllers: [CertificateController],
  providers: [CertificateService],
  exports:[CertificateService]
})
export class CertificateModule {}
