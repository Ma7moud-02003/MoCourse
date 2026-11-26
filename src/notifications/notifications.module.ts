import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { NotificationEntity } from './notification.entity';

@Module({
  imports:[TypeOrmModule.forFeature([NotificationEntity]),CommonModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports:[NotificationsService]
})
export class NotificationsModule {}
