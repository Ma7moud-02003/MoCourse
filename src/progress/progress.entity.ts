
import { LessonsEntity } from "src/lesson/lessons.entity";
import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn, Index } from "typeorm";
@Unique(['user', 'lesson'])
@Entity({name:'progreses'})
export class ProgressEntity{
   @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', default: 0 })
  lastPosition!: number; // آخر ثانية وصلها الطالب

  @Column({ type: 'boolean', default: false })
  completed!: boolean;

  @CreateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
  startedAt!: Date;

  @UpdateDateColumn({type:'timestamp',default:()=>CURRENT_TIMESTAMP})
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date;
  @Index('IDX_progreses_lesson')
  @ManyToOne(()=>LessonsEntity,(lesson)=>lesson.progress,{onDelete:'CASCADE'})
  lesson!:LessonsEntity


    @ManyToOne(()=>UserEntity,(user)=>user.progress)
    user!:UserEntity
    
}
