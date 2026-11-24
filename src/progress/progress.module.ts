import { forwardRef, Module } from '@nestjs/common';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProgressEntity } from './progress.entity';
import { CommonModule } from 'src/common/common.module';
import { LessonModule } from 'src/lesson/lesson.module';
import { SectionModule } from 'src/section/section.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';

@Module({
  controllers: [ProgressController],
  providers: [ProgressService],
    imports:[TypeOrmModule.forFeature([ProgressEntity]),CommonModule,  forwardRef(() => LessonModule),
  forwardRef(() => SectionModule),
  EnrollmentModule
],
    exports:[ProgressService]
  
})
export class ProgressModule {}
