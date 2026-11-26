import { CourseEntity } from "src/course/course.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { EnrollmentStatus } from "src/utils/enums/enroll.enum";
import {  Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({name:'enrollments'})
@Unique('UQ_enrollments_user_course',['user','course'])
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

   // Empty (null) until the student really completes the course (updateEnrollStatus sets it together with
   // status=COMPLETED). It has no database default on purpose: a default would stamp the enrollment time.
   @Column({ nullable: true ,type:'timestamp'})
  completedAt!: Date | null;

      @ManyToOne(()=>UserEntity,(user)=>user.enrolls)
      user!:UserEntity

       @ManyToOne(()=>CourseEntity,(course)=>course.enrolls)
      course!:CourseEntity


}
