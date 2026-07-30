import { Module } from '@nestjs/common';
import { PurchaseController } from './purchase.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { PurchaseEntity } from './purchase.entity';
import { PurchaseService } from './purchase.service';
import { CourseModule } from 'src/course/course.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';

@Module({
  controllers: [PurchaseController],
  providers: [PurchaseService],
    imports:[TypeOrmModule.forFeature([PurchaseEntity]),CommonModule,CourseModule,EnrollmentModule,CloudinaryModule]
  
})
export class PurchaseMoule {}
