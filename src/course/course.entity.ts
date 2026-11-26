import { CategoryEntity } from "src/category/category.entity";
import { CertificateEntity } from "src/certificate/certificate.entity";
import { EnrollmentEntity } from "src/enrollment/enrollment.entity";
import { QuizEntity } from "src/quiz/quiz.entity";
import { ReviewEntity } from "src/review/review.enity";
import { SectionEntity } from "src/section/section.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { CourseLevel } from "src/utils/enums/level.enum";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, Index } from "typeorm";

@Entity({name:'courses'})
export class CourseEntity{
    @PrimaryGeneratedColumn()
    id!:number;

    @Column({length:100})
    title!:string;

    @Column({nullable:true})
    describtion!:string;
  
    @Column({})
    price!:number;

    @Column({type:'text',array:true})
    covers!:string[]

    @Column({type:'text',array:true, default: () => "'{}'",})
    requirements!: string[];


    @Column({nullable:true})
     thumbnail !:string;   //  صورة الكورس
     @Column()
     publicId!: string;

     @Column({type:'enum', enum:CourseLevel,default:CourseLevel.INTERMEDIATE})
     level!:CourseLevel

     @Column({ default: true })
     isPublished!: boolean;
  
     @Column({ nullable: true })
     discountPrice!: number;
      
     @Column({ default: 0 })
    duration!: number;
  
    @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
    createdAt!:Date


    @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!:Date
    
    @Index('IDX_courses_instractor')
    @ManyToOne(()=>UserEntity,(user)=>user.courses)
    Instractor!:UserEntity
     
    @Index('IDX_courses_category')
    @ManyToOne(()=>CategoryEntity,(catog)=>catog.courses)
    category!:CategoryEntity

    
      
    @OneToMany(()=>SectionEntity,(section)=>section.course,{onDelete :'CASCADE'})
    sections!:SectionEntity[]
    
    @OneToMany(()=>EnrollmentEntity,(enroll)=>enroll.course,{onDelete:'CASCADE'})
    enrolls!:EnrollmentEntity[]

    @OneToMany(()=>QuizEntity,(quiz)=>quiz.course,{onDelete:'CASCADE'})
    quizzes!:QuizEntity[]

    @OneToMany(()=>ReviewEntity,(rev)=>rev.course,{onDelete:'CASCADE'})
    reviews!:ReviewEntity[]
    
    @OneToMany(()=>CertificateEntity,(certificate)=>certificate.course)
    certificates!:CertificateEntity[]

    
}
