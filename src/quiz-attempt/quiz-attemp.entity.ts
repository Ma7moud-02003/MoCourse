import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { QuizEntity } from "../quiz/quiz.entity";
import { StudentAnswerEntity } from "../student-answer/student_answer.entity";

@Entity()
export class QuizAttemptEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        default: 0
    })
    score!: number;

    @Column({
        default: false
    })
    passed!: boolean;

    @Column({
        default: false
    })
    submitted!: boolean;

    @Column({
        default: 1
    })
    attemptNumber!: number;

    @CreateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP})
    startedAt!: Date;
    
  @CreateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP})
    expiresAt!: Date;
    
    @UpdateDateColumn
    ({type:"timestamp",default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    submittedAt!: Date;

    @ManyToOne(() => UserEntity,  user => user.quizAttempts,{onDelete: 'CASCADE'})
    user!: UserEntity;

    @ManyToOne(() => QuizEntity,quiz => quiz.attempts,{onDelete: 'CASCADE'})
    quiz!: QuizEntity;

    @OneToMany(() => StudentAnswerEntity,answer => answer.attempt,{cascade: true})
    answers!: StudentAnswerEntity[];
}