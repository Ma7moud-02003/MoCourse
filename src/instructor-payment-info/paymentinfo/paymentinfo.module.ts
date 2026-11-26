import { Module } from '@nestjs/common';
import { PaymentinfoController } from './paymentinfo.controller';
import { PaymentinfoService } from './paymentinfo.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentInfoEntity } from '../paymentInfo.entity';
import { CourseEntity } from 'src/course/course.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports:[TypeOrmModule.forFeature([PaymentInfoEntity,CourseEntity]),CommonModule],
  controllers: [PaymentinfoController],
  providers: [PaymentinfoService],
  exports:[PaymentinfoService]
})
export class PaymentinfoModule {}
