import { CategoryEntity } from "src/category/category.entity";
import { EnrollmentEntity } from "src/enrollment/enrollment.entity";
import { SectionEntity } from "src/section/section.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { CourseLevel } from "src/utils/enums/level.enum";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

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

    @Column({nullable:true})
     thumbnail !:string;   //  صورة الكورس
     @Column()
     publicId!: string;

     @Column({type:'enum', enum:CourseLevel,default:CourseLevel.INTERMEDIATE})
     level!:CourseLevel

     @Column({ default: false })
     isPublished!: boolean;
  
     @Column({ nullable: true })
     discountPrice!: number;
      
     @Column({ default: 0 })
    duration!: number;
  
    @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
    createdAt!:Date


    @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!:Date
    
    @ManyToOne(()=>UserEntity,(user)=>user.courses)
    Instractor!:UserEntity
     
    @ManyToOne(()=>CategoryEntity,(catog)=>catog.courses)
    category!:CategoryEntity

      
    @OneToMany(()=>SectionEntity,(section)=>section.course)
    sections!:SectionEntity[]
    
    @OneToMany(()=>EnrollmentEntity,(enroll)=>enroll.course)
    enrolls!:EnrollmentEntity[]
    
    
}