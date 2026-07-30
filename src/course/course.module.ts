import { Module } from '@nestjs/common';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from './course.entity';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  controllers: [CourseController],
  providers: [CourseService],
    imports:[TypeOrmModule.forFeature([CourseEntity]),CloudinaryModule,CommonModule],
    exports:[CourseService]
    
  
})
export class CourseModule {}
