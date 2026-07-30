import { Module } from '@nestjs/common';
import { EnrollmentController } from './enrollment.controller';
import { EnrollmentService } from './enrollment.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EnrollmentEntity } from './enrollment.entity';
import { CommonModule } from 'src/common/common.module';
import { CourseEntity } from 'src/course/course.entity';

@Module({
  controllers: [EnrollmentController],
  providers: [EnrollmentService],
    imports:[TypeOrmModule.forFeature([EnrollmentEntity,CourseEntity]),CommonModule],
    exports:[EnrollmentService]
  
})
export class EnrollmentModule {}
