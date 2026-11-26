import { ProgressEntity } from "src/progress/progress.entity";
import { QuizEntity } from "src/quiz/quiz.entity";
import { SectionEntity } from "src/section/section.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { LessonType } from "src/utils/enums/lessonType.enum";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({name:'lessons'})
export class LessonsEntity{
    @PrimaryGeneratedColumn()
    id!:number;

    @Column({length:100})
    title!:string;

    @Column({ nullable: true })
     description!: string;

    @Column({type:'enum',enum:LessonType,default:LessonType.PDF})
    type!:LessonType;

    @Column({nullable:true})
     videoUrl!:string;

    
    @Column({nullable:true})
    pdfUrl!:string;

    @Column({ nullable: true })
videoPublicId!: string;

@Column({ nullable: true })
pdfPublicId!: string;

     @Column({nullable:true})
     content!:string;
      
    @Column({nullable:true})
     duration!:number; // seconds
     
      @Column()
     order!:number;

     @Column({ nullable: true })
     fileSize!: number;
   
     @Column({type:'boolean',default:true})
     isPreview!:boolean;

     
     

    @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
    createdAt!:Date


    @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!:Date
    
   

      
    @ManyToOne(()=>SectionEntity,(section)=>section.lessons)
    section!:SectionEntity

       
    @OneToMany(()=>ProgressEntity,(progress)=>progress.lesson,{onDelete:'CASCADE'})
    progress!:ProgressEntity[]
    
    
    @OneToMany(()=>QuizEntity,(quiz)=>quiz.lesson,{onDelete:'CASCADE'})
    quizzes!:QuizEntity[]
    
}
