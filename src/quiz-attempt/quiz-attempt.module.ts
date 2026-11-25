import { Module } from '@nestjs/common';
import { QuizAttemptController } from './quiz-attempt.controller';
import { QuizAttemptService } from './quiz-attempt.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizAttemptEntity } from './quiz-attemp.entity';
import { QuizEntity } from 'src/quiz/quiz.entity';
import { CommonModule } from 'src/common/common.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';

@Module({
  imports:[TypeOrmModule.forFeature([QuizAttemptEntity, QuizEntity]), CommonModule, EnrollmentModule],
  controllers: [QuizAttemptController],
  providers: [QuizAttemptService]
})
export class QuizAttemptModule {}
