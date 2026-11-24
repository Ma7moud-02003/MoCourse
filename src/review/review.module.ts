import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReviewEntity } from './review.enity';
import { CourseModule } from 'src/course/course.module';
import { UserModule } from 'src/User/user/user.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports:[TypeOrmModule.forFeature([ReviewEntity]),CourseModule,UserModule,EnrollmentModule,CommonModule],
  controllers: [ReviewController],
  providers: [ReviewService]
})
export class ReviewModule {}
