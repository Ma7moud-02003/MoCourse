import { CategoryEntity } from "src/category/category.entity";
import { ProgressEntity } from "src/progress/progress.entity";
import { SectionEntity } from "src/section/section.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { LessonType } from "src/utils/enums/lessonType.enum";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({name:'lessons'})
export class LessonsEntity{
    @PrimaryGeneratedColumn()
    id!:number;

    @Column({length:100})
    title!:string;

    @Column({type:'enum',enum:LessonType,default:LessonType.PDF})
    type!:LessonType;

    @Column({nullable:true})
     videoUrl!:string;

    
    @Column({nullable:true})
    pdfUrl!:string;

     @Column({nullable:true})
     content!:string;
      
    @Column({nullable:true})
     duration!:string;
    
      @Column()
     order!:number;
   
     @Column({type:'boolean'})
     isPreview!:boolean;

     
     

    @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
    createdAt!:Date


    @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!:Date
    
   

      
    @ManyToOne(()=>SectionEntity,(section)=>section.lessons)
    section!:SectionEntity

       
    @OneToMany(()=>ProgressEntity,(progress)=>progress.lesson)
    progress!:ProgressEntity[]
    
    
}