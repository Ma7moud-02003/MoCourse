import { forwardRef, Module } from '@nestjs/common';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentEntity } from './enrollment.entity';
import { CommonModule } from 'src/common/common.module';
import { CourseEntity } from 'src/course/course.entity';
import { CourseModule } from 'src/course/course.module';
import { CertificateModule } from 'src/certificate/certificate.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  controllers: [EnrollmentController],
  providers: [EnrollmentService],
    imports:[TypeOrmModule.forFeature([EnrollmentEntity,CourseEntity]),CommonModule
    ,forwardRef(()=>CourseModule),CertificateModule,NotificationsModule],
    exports:[EnrollmentService]
  
})
export class EnrollmentModule {}
