
import { CourseEntity } from "src/course/course.entity";
import { LessonsEntity } from "src/lesson/lessons.entity";
import { QuizEntity } from "src/quiz/quiz.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({name:'sections'})
export class SectionEntity{
    @PrimaryGeneratedColumn()
    id!:number;

    @Column({length:100})
    title!:string;

 
  @Column()
  order!:number;

 

  
    @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
    createdAt!:Date


    @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!:Date
    
    @ManyToOne(()=>CourseEntity,(course)=>course.sections)
    course!:CourseEntity
   
    
    @OneToMany(()=>LessonsEntity,(lesson)=>lesson.section,{onDelete:'CASCADE'})
    lessons!:LessonsEntity[]

    
    @OneToMany(()=>QuizEntity,(quiz)=>quiz.section,{onDelete:'CASCADE'})
   quizzes!:QuizEntity[]


}
