import { CourseEntity } from "src/course/course.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { UserRoles } from "src/utils/enums/userRole.enum";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({name:'enrollments'})
export class EnrollmentEntity{
    @PrimaryGeneratedColumn()
    id!:number;

      @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,nullable:true})
      enrolledAt!:Date
      

      @ManyToOne(()=>UserEntity,(user)=>user.enrolls)
      user!:UserEntity

       @ManyToOne(()=>CourseEntity,(course)=>course.enrolls)
      course!:CourseEntity


}