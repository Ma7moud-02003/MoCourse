import { CourseEntity } from "src/course/course.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { EnrollmentStatus } from "src/utils/enums/enroll.enum";
import {  Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity({name:'enrollments'})
export class EnrollmentEntity{
    @PrimaryGeneratedColumn()
    id!:number;

      @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,nullable:true})
      enrolledAt!:Date
      
      @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.IN_PROGRESS})
   status!: EnrollmentStatus;

   @Column({ nullable: true ,type:'timestamp',default:()=>CURRENT_TIMESTAMP})
  completedAt!: Date;

      @ManyToOne(()=>UserEntity,(user)=>user.enrolls)
      user!:UserEntity

       @ManyToOne(()=>CourseEntity,(course)=>course.enrolls)
      course!:CourseEntity


}
