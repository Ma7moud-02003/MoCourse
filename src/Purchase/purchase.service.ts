import {  BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PurchaseEntity } from './purchase.entity';
import { Repository } from 'typeorm';
import { CourseService } from 'src/course/course.service';
import { StatusEnum } from 'src/utils/enums/purchaseStatus.enum';
import { PaymentMethoeEnum } from 'src/utils/enums/paymentMethode.enum';
import { ConfirmCheckoutDto } from './dtos/confirm.dto';
import { EnrollmentService } from 'src/enrollment/enrollment.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';


@Injectable()
export class PurchaseService {

    constructor(
    @InjectRepository(PurchaseEntity)
    private purchaseRepo:Repository<PurchaseEntity>,
    private courseServise:CourseService,
    private enrollService:EnrollmentService,
    private cloudService:CloudinaryService

        
    ){}

    /**
  /**
 * Creates a purchase record for a course and redirects the student
 * to the payment gateway.
 * If the student already owns the course, an exception is thrown.
 * If there is a pending or failed purchase, the existing purchase
 * is reused and the student is redirected to payment again.
 * @param studentId - The ID of the student.
 * @param courseId - The ID of the course to purchase.
 * @returns An object containing the payment gateway URL.
 * @throws NotFoundException If the course does not exist.
 * @throws BadRequestException If the student already owns the course.
 */
public  async buyCourse(studentId:number,courseId:number){
    if(!studentId&&courseId) throw new NotFoundException('Student Id Or Course Id Is Not Found')
        const course=await this.courseServise.getSingleCourse(courseId);
        if(!course) throw new NotFoundException('Course does not exist');
        const exist=await this.purchaseRepo.findOne({where:{
            course:{id:courseId},
            user:{id:studentId}

        }})
        const status=StatusEnum;
       if(exist){
        switch(exist?.status){
        case status.PAID:
        throw new BadRequestException('You alrealdy own this course');
        case status.PENDING:
    return {
     message:'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد' }
      
        case status.FAILED:{
        exist.status=status.PENDING;
        await this.purchaseRepo.save(exist)
    return {
     message:'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد' }
      }
        }
       }
        const amount =course.discountPrice??course.price;
        const purchase=this.purchaseRepo.create({
            course:{id:courseId},
            user:{id:studentId},
            amount:amount,
            status:StatusEnum.PENDING

        })
        await this.purchaseRepo.save(purchase)
        
        return {
     message:'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد' }
      }  

      /**
       * confirm payment from student
       * @param id 
       * @param dto 
       * @returns wateing for approved message
       */

    public async confirmCheckOut(courseId:number,dto:ConfirmCheckoutDto,userId:number,file:any){
     if(!courseId||!dto||!userId||!file) throw new BadRequestException('some required values are missed');
     const image=await this.cloudService.uploadFile(file);
    const paymentMethode:PaymentMethoeEnum=dto.paymentMethod;
    const transaction:string=dto.transactionId;
     if(!courseId||!paymentMethode||!transaction||!userId) throw new BadRequestException('some require value is missed');
     const purchase=await this.purchaseRepo.findOne({
    where:{
        course:{id:courseId},user:{id:userId}
    },relations:{user:true},select:{user:{id:true}}
     })
if(!purchase) throw new NotFoundException('Purchase Not Fond');
console.log(purchase.user.id);
if(purchase.user.id!=userId) throw new UnauthorizedException('You Can not Access That Purchase')
purchase.status=StatusEnum.WAITING_APPROVAL;
purchase.transactionId=transaction;
purchase.paymentMethod=paymentMethode;
purchase.thumbnail=image.secure_url;
purchase.publicId=image.public_id;
return await this.purchaseRepo.save(purchase);
}


public async getInsPurchase(insId:number){
  const purchases=await this.purchaseRepo.find({
    where:{
course:{
    Instractor:{id:insId}
}
    },relations:{
        user:true,
        course:true
    },select:{
        user:{
            fullName:true,
            email:true
        },course:{
            title:true,
            id:true,
            discountPrice:true,
            price:true,
            thumbnail:true,
           }
    }
  })
  if(!purchases||purchases.length==0) throw new NotFoundException('No Purchase for you');
  return purchases; 
      }


      public async updatPurchaseStatus(purchaseId:number,status:StatusEnum,insId:number){
        if(!status||!purchaseId||!insId)  throw new BadRequestException('Status or id  have not sended');
        const purchase=await this.purchaseRepo.findOne({
            where:{
                id:purchaseId
            },relations:{
                course:{
                    Instractor:true
                },
                user:true
            },select:{
                course:{
                    id:true,
                    Instractor:{
                        id:true
                    }},user:{
                        id:true
                    }
                }})                    
            if(!purchase) throw new NotFoundException('Not Found');
            if(purchase?.course.Instractor.id!=insId) throw new UnauthorizedException('You Can Not Access That');
            purchase.status=status??purchase.status;
            await this.purchaseRepo.save(purchase);
            switch(status){
                case StatusEnum.FAILED : return {message :'Operation Rejected Succssfully'};
                case StatusEnum.PAID :{
                await this.enrollService.enrollCourse(purchase.course.id,purchase.user.id);
               return {
                message:'Purchase Updated Successfully & Student emrollmented successfully'
               }
                }
            }
            
        
      }

     

}