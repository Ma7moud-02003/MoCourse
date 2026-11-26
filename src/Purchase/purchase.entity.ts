import { CourseEntity } from "src/course/course.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { PaymentMethoeEnum } from "src/utils/enums/paymentMethode.enum";
import { StatusEnum } from "src/utils/enums/purchaseStatus.enum";
import {  Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn, Index } from "typeorm";

@Entity({name:'purchase'})
@Unique('UQ_purchase_user_course',['user','course'])
export class PurchaseEntity{
    @PrimaryGeneratedColumn()
    id!:number;

      @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,nullable:true})
      enrolledAt!:Date
       
      @Column({type:'enum',enum:StatusEnum,default:StatusEnum.PENDING})
      status!:StatusEnum
       @Column({nullable:true,type:'enum',enum:PaymentMethoeEnum})
       paymentMethod!:string

      @Column({nullable:true})
      transactionId!:string
      @Column()
      amount!:number
      @Column({nullable:true})
      thumbnail!:string;
     @Column({nullable:true})
     publicId!: string;
      @ManyToOne(()=>UserEntity,(user)=>user.enrolls)
      user!:UserEntity
       @Index('IDX_purchase_course')
       @ManyToOne(()=>CourseEntity,(course)=>course.enrolls)
      course!:CourseEntity


}
