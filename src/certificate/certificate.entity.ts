import { CourseEntity } from "src/course/course.entity";
import { UserEntity } from "src/User/user.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity({name:'certificates'})
// One certificate per student per course. Enforced by the database so two
// concurrent completions cannot both issue one.
@Unique('UQ_certificates_student_course', ['student', 'course'])
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

   @ManyToOne(()=>CourseEntity,(course)=>course.certificates)
  course!:CourseEntity

}
