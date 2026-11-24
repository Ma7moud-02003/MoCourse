import { forwardRef, Module } from '@nestjs/common';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourseEntity } from './course.entity';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { CommonModule } from 'src/common/common.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';


@Module({
  controllers: [CourseController],
  providers: [CourseService],
    imports:[TypeOrmModule.forFeature([CourseEntity]),CloudinaryModule,CommonModule,forwardRef(()=>EnrollmentModule)],
    exports:[CourseService]
    
  
})
export class CourseModule {}
