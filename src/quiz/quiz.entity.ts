import { CourseEntity } from "src/course/course.entity";
import { LessonsEntity } from "src/lesson/lessons.entity";
import { SectionEntity } from "src/section/section.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { QuestionEntity } from "../question/question.entity";
import { QuizAttemptEntity } from "../quiz-attempt/quiz-attemp.entity";
import { QuizTargetType } from "src/utils/enums/quizTarget.enum";

@Entity()
export class QuizEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 150 })
    title!: string;

    @Column({ nullable: true })
    description!: string;

    @Column()
    passMark!: number;

    @Column()
    timeLimit!: number; // بالدقائق

    @Column({ default: 1 })
    maxAttempts!: number;

    @Column({ default: false })
    shuffleQuestions!: boolean;

    @Column({ default: false })
    shuffleChoices!: boolean;

    // sum of the question marks, kept up to date by the server
    @Column({ default: 0 })
    totalMarks!: number;

    @Column({ type: 'text', nullable: true })
    instructions!: string;

    @Column({ default: false })
    showResultImmediately!: boolean;

    @Column({type:'enum',enum:QuizTargetType})
    quizTarget!:QuizTargetType

    @Column({ default: false })
    isPublished!: boolean;

    @CreateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP})
    createdAt!: Date;

    @UpdateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!: Date;

    @ManyToOne(() => CourseEntity, course => course.quizzes, {
    nullable: false,
    onDelete: 'CASCADE'
})
course!: CourseEntity;
@ManyToOne(() => SectionEntity, section => section.quizzes, {
    nullable: true,
    onDelete: 'CASCADE'
})
section!: SectionEntity;

@ManyToOne(() => LessonsEntity, lesson => lesson.quizzes, {
    nullable: true,
    onDelete: 'CASCADE'
})
lesson!: LessonsEntity;

@OneToMany(() => QuestionEntity, question => question.quiz)
questions!: QuestionEntity[];

@OneToMany(() => QuizAttemptEntity, attempt => attempt.quiz)
attempts!: QuizAttemptEntity[];
}
