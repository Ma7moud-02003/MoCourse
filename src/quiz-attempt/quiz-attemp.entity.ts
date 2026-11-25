import { UserEntity } from "src/User/user.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { QuizEntity } from "../quiz/quiz.entity";
import { StudentAnswerEntity } from "../student-answer/student_answer.entity";

// one attempt per student per exam (also backs the attempt lookup and count by exam)
@Unique(['quiz', 'user'])
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
    
    // deadline = startedAt + the exam timeLimit; the server sets it when the attempt starts
    @Column({type:"timestamp"})
    expiresAt!: Date;
    
    // empty until the student submits; the server sets it once at submit
    @Column({type:"timestamp",nullable:true})
    submittedAt!: Date | null;

    @ManyToOne(() => UserEntity,  user => user.quizAttempts,{onDelete: 'CASCADE'})
    user!: UserEntity;

    @ManyToOne(() => QuizEntity,quiz => quiz.attempts,{onDelete: 'CASCADE'})
    quiz!: QuizEntity;

    @OneToMany(() => StudentAnswerEntity,answer => answer.attempt,{cascade: true})
    answers!: StudentAnswerEntity[];
}
