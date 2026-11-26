import { UserEntity } from "src/User/user.entity";
import { NotificationType } from "src/utils/enums/notification.enum";
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Index } from "typeorm";

@Entity()
export class NotificationEntity {

    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    title!: string;

    @Column({ type: 'text' })
    message!: string;

    @Column({
        type: 'enum',
        enum: NotificationType
    })
    type!: NotificationType;

    @Column({ default: false })
    isRead!: boolean;

    @Column({ nullable: true })
    resourceId!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @Index('IDX_notification_user')
    @ManyToOne(() => UserEntity, (user) => user.notifications, {
        onDelete: 'CASCADE'
    })
    user!: UserEntity;
}
