
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEntity } from './notification.entity';
import { Repository } from 'typeorm';
import { NotificationType } from 'src/utils/enums/notification.enum';

@Injectable()
export class NotificationsService {
    constructor(
        @InjectRepository(NotificationEntity)
        private notifiRepo:Repository<NotificationEntity>
    ){}

    public async creatNotification(
        resourceId:number,userId:number,title:string,message:string,type:NotificationType
    ){
        const notification=this.notifiRepo.create({
            user:{id:userId},
            title,
            message,
            type,
            resourceId

        })

        await this.notifiRepo.save(notification);
    }

    /**
     * The caller's own notifications, newest first, paginated (limit default 20, max 50).
     * Always filtered by the caller's id, so nobody can see another user's notifications.
     */
    public async getMyNotitfications(userId:number,page:number=1,limit:number=20){
         if(!userId) throw new NotFoundException();
         const take=Math.min(Math.max(Math.floor(limit)||20,1),50);
         const safePage=Math.max(Math.floor(page)||1,1);
         const [items,total]=await this.notifiRepo.findAndCount({
             where:{user:{id:userId}},
             order:{createdAt:'DESC',id:'DESC'},
             take,skip:(safePage-1)*take
         });
         return {
             items:items.map((n)=>this.toView(n)),
             page:safePage,limit:take,total,totalPages:Math.ceil(total/take)
         };
    }

    public async getUnreadCount(userId:number){
        if(!userId) throw new NotFoundException();
        const unreadCount=await this.notifiRepo.count({where:{user:{id:userId},isRead:false}});
        return {unreadCount};
    }

    /** Marks one of the caller's own notifications as read. Someone else's (or a missing) id gives 404. */
    async markAsRead(notificationId: number, userId: number) {
        const notification = await this.notifiRepo.findOne({
            where: { id: notificationId, user: { id: userId } },
        });
        if (!notification) throw new NotFoundException('Notification Not Found');
        if(!notification.isRead){
            notification.isRead = true;
            await this.notifiRepo.save(notification);
        }
        return this.toView(notification);
    }

    /** Marks every unread notification of the caller as read. Other users' rows are never touched. */
    async markAllAsRead(userId:number){
        if(!userId) throw new NotFoundException();
        const res=await this.notifiRepo.createQueryBuilder().update(NotificationEntity)
            .set({isRead:true})
            .where('"userId" = :userId AND "isRead" = false',{userId})
            .execute();
        return {updated:res.affected??0};
    }

    // only the notification's own fields: never the owning user
    private toView(n:NotificationEntity){
        return {id:n.id,title:n.title,message:n.message,type:n.type,isRead:n.isRead,resourceId:n.resourceId,createdAt:n.createdAt};
    }
}
