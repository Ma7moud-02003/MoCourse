
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

    public async getMyNotitfications(userId:number){
         if(!userId) throw new NotFoundException();
         const notifs=await this.notifiRepo.find({where:{user:{id:userId}}});
         return notifs;
    }

    
 async markAsRead(notificationId: number, userId: number) {
    const notification = await this.notifiRepo.findOne({
      where: {
        id: notificationId,
        user: { id: userId },
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification Not Found');
    }

    notification.isRead = true;

    return await this.notifiRepo.save(notification);
  }

}
