import { CourseEntity } from "src/course/course.entity";
import { EnrollmentEntity } from "src/enrollment/enrollment.entity";
import { ProgressEntity } from "src/progress/progress.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { UserRoles } from "src/utils/enums/userRole.enum";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
 @Entity({name:'users'})
export class UserEntity{
    @PrimaryGeneratedColumn()
    id!:number;

    @Column({length:100})
    fullName!:string;

    @Column({unique:true})
    email!:string;

    @Column({length:150})
    password!:string;

    @Column({type:'enum',enum:UserRoles,default:UserRoles.STUDENT})
    role!:UserRoles;

    @Column({nullable:true})
    avatar!:string;

   @Column({default: false})
    isVerified!: boolean

    @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
    createdAt!:Date


    @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!:Date

    @OneToMany(()=>CourseEntity,(course)=>course.Instractor)
    courses!:CourseEntity[]

    @OneToMany(()=>ProgressEntity,(progress)=>progress.user)
    progress!:ProgressEntity[]
   
   @OneToMany(()=>EnrollmentEntity,(enroll)=>enroll.user)
   enrolls!:EnrollmentEntity[]

}