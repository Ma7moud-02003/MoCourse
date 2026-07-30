import { UserEntity } from "src/User/user.entity";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
@Entity({name:'payment_info'})
export class PaymentInfoEntity{
@PrimaryGeneratedColumn()
id!:number
@Column({nullable:true})
instapay!:string;
@Column({nullable:true})
vodafonCach!:string;
@Column({nullable:true})
orangeCash!:string;
@Column({nullable:true})
bankAccount!:string;
@Column({nullable:true})
ownerName!:string;
@OneToOne(()=>UserEntity,(user)=>user.paymentInfo)
@JoinColumn()
instractor!: UserEntity
}