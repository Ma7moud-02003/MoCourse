import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
        const already=await this.paymentInfoRepo.findOne({where:{instractor:{id:instractorId}}});
        if(already) throw new ConflictException('Payment information already exists, update it instead');
        const paymentInfo=this.paymentInfoRepo.create({
        instapay:dto.instapay,
        vodafonCach:dto.vodafoneCash,
        orangeCash:dto.orangeCash,
        bankAccount:dto.bankAccount,
        ownerName:dto.ownerName,
        instractor:{id:instractorId}
    })

    try{
    await this.paymentInfoRepo.save(paymentInfo);
    }catch(e:any){
      // two adds at the same moment: the database unique rule lets one win, the other gets the same 409
      if((e?.code??e?.driverError?.code)==='23505') throw new ConflictException('Payment information already exists, update it instead');
      throw e;
    }
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

        // null when the instructor has not added any payment info
        async findInsPaymentInfo(instractorId:number){
            return await this.paymentInfoRepo.findOne({where:{instractor:{id:instractorId}}});
          }

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
