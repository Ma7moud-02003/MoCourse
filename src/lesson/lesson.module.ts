import { forwardRef, Module } from '@nestjs/common';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonsEntity } from './lessons.entity';
import { CommonModule } from 'src/common/common.module';
import { SectionModule } from 'src/section/section.module';
import { CourseModule } from 'src/course/course.module';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';
import { ProgressModule } from 'src/progress/progress.module';

@Module({
  controllers: [LessonController],
  providers: [LessonService],
    imports:[TypeOrmModule.forFeature([LessonsEntity]),CommonModule,SectionModule,
    forwardRef(()=>CourseModule),CloudinaryModule,EnrollmentModule],
    exports:[LessonService]
  
})
export class LessonModule {}
