import { Module } from '@nestjs/common';
import { LessonController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonsEntity } from './lessons.entity';

@Module({
  controllers: [LessonController],
  providers: [LessonService],
    imports:[TypeOrmModule.forFeature([LessonsEntity])]
  
})
export class LessonModule {}
