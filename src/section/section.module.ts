import { Module } from '@nestjs/common';
import { SectionController } from './section.controller';
import { SectionService } from './section.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SectionEntity } from './section.entity';
import { CommonModule } from 'src/common/common.module';
import { CourseModule } from 'src/course/course.module';

@Module({
  controllers: [SectionController],
  providers: [SectionService],
    imports:[TypeOrmModule.forFeature([SectionEntity]),CommonModule,CourseModule]
  
})
export class SectionModule {}
