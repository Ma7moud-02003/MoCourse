import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, Index } from "typeorm";
import { QuestionEntity } from "../question/question.entity";
import { StudentAnswerEntity } from "../student-answer/student_answer.entity";

@Entity()
export class ChoiceEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column('text')
    text!: string;

    @Column({
        default: false
    })
    isCorrect!: boolean;

    @Column({
        default: 1
    })
    order!: number;

 @CreateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP})
    createdAt!: Date;

    @UpdateDateColumn
    ({type:"timestamp",default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!: Date;

    @Index('IDX_choice_question')
    @ManyToOne(
        () => QuestionEntity,
        question => question.choices,
        {
            onDelete: 'CASCADE'
        }
    )
    question!: QuestionEntity;

    @OneToMany(
        () => StudentAnswerEntity,
        answer => answer.choice
    )
    answers!: StudentAnswerEntity[];
}
