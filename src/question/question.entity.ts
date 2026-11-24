import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { QuestionType } from "../utils/enums/questionTyoe.enum";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { QuizEntity } from "../quiz/quiz.entity";
import { ChoiceEntity } from "../choice/choise.entity";
import { StudentAnswerEntity } from "../student-answer/student_answer.entity";

@Entity()
export class QuestionEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        type: 'enum',
        enum: QuestionType,
        default: QuestionType.MCQ
    })
    type!: QuestionType;

    @Column('text')
    question!: string;

    @Column({
        default: 1
    })
    mark!: number;

    @Column({
        default: 1
    })
    order!: number;

    @CreateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP})
    createdAt!: Date;

    @UpdateDateColumn
    ({type:"timestamp",default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!: Date;

    @ManyToOne(() => QuizEntity,quiz => quiz.questions,{onDelete: 'CASCADE'})
    quiz!: QuizEntity;

    @OneToMany(() => ChoiceEntity,choice => choice.question,{cascade: true})
     choices!: ChoiceEntity[];

   @OneToMany(() => StudentAnswerEntity,answer => answer.question)
   answers!: StudentAnswerEntity[];

}