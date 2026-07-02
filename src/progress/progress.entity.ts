
import { LessonsEntity } from "src/lesson/lessons.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({name:'progreses'})
export class ProgressEntity{
    @PrimaryGeneratedColumn()
    id!:number;

    @Column({type:'boolean'})
    isCompleted!:boolean;

     @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,nullable:true})
      completedAt!:Date
      
    @ManyToOne(()=>LessonsEntity,(lesson)=>lesson.progress)
    lesson!:LessonsEntity


    @ManyToOne(()=>UserEntity,(user)=>user.progress)
    user!:UserEntity
    
}