import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionEntity } from './question.entity';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { QuizModule } from 'src/quiz/quiz.module';
import { CommonModule } from 'src/common/common.module';
import { ChoiceEntity } from 'src/choice/choise.entity';


@Module({
  imports:[TypeOrmModule.forFeature([QuestionEntity,ChoiceEntity]),QuizModule,CommonModule],
  controllers: [QuestionController],
  providers: [QuestionService]
})
export class QuestionModule {}
