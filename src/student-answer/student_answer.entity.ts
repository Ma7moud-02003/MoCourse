import { Column, CreateDateColumn, Entity, ManyToOne, Unique, PrimaryGeneratedColumn, Index } from "typeorm";
import { QuizAttemptEntity } from "../quiz-attempt/quiz-attemp.entity";
import { QuestionEntity } from "../question/question.entity";
import { ChoiceEntity } from "../choice/choise.entity";

@Entity()
@Unique(['attempt', 'question'])
export class StudentAnswerEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        default: false
    })
    isCorrect!: boolean;

    @Column({
        default: 0
    })
    earnedMark!: number;

    @CreateDateColumn({type:"timestamptz"})
    answeredAt!: Date;

    @ManyToOne(() => QuizAttemptEntity,attempt => attempt.answers,{onDelete: 'CASCADE'})
    attempt!: QuizAttemptEntity;

    @Index('IDX_student_answer_question')
    @ManyToOne(() => QuestionEntity,question => question.answers,{onDelete: 'CASCADE'})
    question!: QuestionEntity;

    @ManyToOne(() => ChoiceEntity,choice => choice.answers,{onDelete: 'CASCADE'})
    choice!: ChoiceEntity;
}
