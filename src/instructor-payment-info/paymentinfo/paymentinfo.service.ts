import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaymentInfoEntity } from '../paymentInfo.entity';
import { Repository } from 'typeorm';
import { PaymentInfoDto } from './dtos/paymentInfo.dto';

@Injectable()
export class PaymentinfoService {
    constructor(
        @InjectRepository(PaymentInfoEntity)
                private paymentInfoRepo:Repository<PaymentInfoEntity>
            ){}

        async addPaymentInfo(dto:PaymentInfoDto,instractorId:number){
        const paymentInfo=this.paymentInfoRepo.create({
       ...dto,
        instractor:{id:instractorId}
    })

    await this.paymentInfoRepo.save(paymentInfo);
    return {
        message:'Payment Information added successfully'
    }
        }

          async updatedPaymentInfo(dto:PaymentInfoDto,instractorId:number){
          const payment=await this.paymentInfoRepo.findOne({where:{
            instractor:{id:instractorId}
          }})
          if(!payment) throw new BadRequestException()
          payment.instapay=dto.instapay??payment?.instapay;
          payment.vodafonCach=dto.vodafoneCash??payment?.vodafonCach;
          payment.orangeCash=dto.orangeCash??payment?.orangeCash;
          payment.bankAccount=dto.bankAccount??payment?.bankAccount
          payment.ownerName=dto.ownerName??payment?.ownerName;
          await this.paymentInfoRepo.save(payment);
          return {
            message:'Updated Successfully'
          }}

        async  getInsPatmentInfo(instractorId:number){
            const payment=await this.paymentInfoRepo.findOne({where:{
                instractor:{id:instractorId}
            }})
            if(!payment) throw new NotFoundException('That Info not Found');
            return payment;
          }


           async  getAllPaymentInfo(){
            const payments=await this.paymentInfoRepo.find()
            return payments;
          }

}

