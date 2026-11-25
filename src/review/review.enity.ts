import { CourseEntity } from "src/course/course.entity";
import { CURRENT_TIMESTAMP } from "src/utils/constants";
import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from "typeorm";
import { UserEntity } from "src/User/user.entity";

@Entity({name:'reviews'})
@Unique('UQ_reviews_user_course',['user','course'])
export class ReviewEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ length: 150 })
    comment!: string;

    @Column()
    rateing!: number;

    

    @CreateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP})
    createdAt!: Date;

    @UpdateDateColumn({type:"timestamp",default:()=>CURRENT_TIMESTAMP,onUpdate:CURRENT_TIMESTAMP})
    updatedAt!: Date;

    @ManyToOne(() => CourseEntity, course => course.reviews, {
    nullable: true,
    // onDelete:'CASCADE'
  })
  course!: CourseEntity;

@ManyToOne(() => UserEntity, section => section.reviews, {
    nullable: true,
    onDelete: 'CASCADE'
})
user!: UserEntity;



}
