import { Module } from '@nestjs/common';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { QuizEntity } from './quiz.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseModule } from 'src/course/course.module';
import { SectionModule } from 'src/section/section.module';
import { LessonModule } from 'src/lesson/lesson.module';
import { CommonModule } from 'src/common/common.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';
import { QuestionEntity } from 'src/question/question.entity';

@Module({
  imports:[TypeOrmModule.forFeature([QuizEntity,QuestionEntity]),CourseModule,SectionModule,LessonModule,CommonModule,EnrollmentModule],
  controllers: [QuizController],
  providers: [QuizService],
  exports:[QuizService]
})
export class QuizModule {}
