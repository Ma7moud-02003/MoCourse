import { Module } from '@nestjs/common';
import { DashboaredService } from './dashboared.service';
import { DashboaredController } from './dashboared.controller';
import { CourseModule } from 'src/course/course.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';
import { ProgressModule } from 'src/progress/progress.module';
import { PurchaseMoule } from 'src/Purchase/purchase.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports:[CourseModule,EnrollmentModule,ProgressModule,PurchaseMoule,CommonModule],
  providers: [DashboaredService],
  controllers: [DashboaredController]
})
export class DashboaredModule {}
