import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user.entity';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { CommonModule } from 'src/common/common.module';
import { EnrollmentModule } from 'src/enrollment/enrollment.module';
import { CourseModule } from 'src/course/course.module';
import { PaymentinfoModule } from 'src/instructor-payment-info/paymentinfo/paymentinfo.module';


@Module({
  controllers: [UserController],
  providers: [UserService,CourseModule],
    imports:[TypeOrmModule.forFeature([UserEntity]),
    CommonModule,CloudinaryModule,EnrollmentModule,PaymentinfoModule
    
  ],
  exports:[UserService]
  
})
export class UserModule {}
