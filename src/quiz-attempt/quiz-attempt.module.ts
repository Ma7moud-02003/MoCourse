import { Module } from '@nestjs/common';
import { QuizAttemptController } from './quiz-attempt.controller';
import { QuizAttemptService } from './quiz-attempt.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizAttemptEntity } from './quiz-attemp.entity';

@Module({
  imports:[TypeOrmModule.forFeature([QuizAttemptEntity])],
  controllers: [QuizAttemptController],
  providers: [QuizAttemptService]
})
export class QuizAttemptModule {}
