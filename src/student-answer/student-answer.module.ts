import { Module } from '@nestjs/common';
import { StudentAnswerController } from './student-answer.controller';
import { StudentAnswerService } from './student-answer.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StudentAnswerEntity } from './student_answer.entity';

@Module({
  imports:[TypeOrmModule.forFeature([StudentAnswerEntity])],
  controllers: [StudentAnswerController],
  providers: [StudentAnswerService]
})
export class StudentAnswerModule {}
