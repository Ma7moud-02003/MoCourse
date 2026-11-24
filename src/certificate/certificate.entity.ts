import { CourseEntity } from "src/course/course.entity";
import { UserEntity } from "src/User/user.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity({name:'certificates'})
export  class CertificateEntity{
 @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  certificateNumber!: string;

  @Column()
  issuedAt!: Date;

  @Column({ nullable: true })
  completedAt!: Date;

  @Column()
  courseTitle!: string;
  
  @ManyToOne(()=>UserEntity,(user)=>user.certificates)
  student!:UserEntity

   @ManyToOne(()=>UserEntity,(course)=>course.certificates)
  course!:CourseEntity

}