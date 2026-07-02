import { CourseEntity } from "src/course/course.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity({name:'categorise'})
export class CategoryEntity{
    @PrimaryGeneratedColumn()
    id!:number;
   @Column({type:'varchar',length:200})
    name!:string;
   @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
    createdAt!:Date
   @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!:Date

    @OneToMany(()=>CourseEntity,(course)=>course.category)
    courses!:CourseEntity[]
}