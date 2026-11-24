import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PurchaseEntity } from './purchase.entity';
import { Repository } from 'typeorm';
import { CourseService } from 'src/course/course.service';
import { StatusEnum } from 'src/utils/enums/purchaseStatus.enum';
import { PaymentMethoeEnum } from 'src/utils/enums/paymentMethode.enum';
import { ConfirmCheckoutDto } from './dtos/confirm.dto';
import { EnrollmentService } from 'src/enrollment/enrollment.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/utils/enums/notification.enum';


@Injectable()
export class PurchaseService {

    constructor(
        @InjectRepository(PurchaseEntity)
        private purchaseRepo: Repository<PurchaseEntity>,
        private courseServise: CourseService,
        private enrollService: EnrollmentService,
        private cloudService: CloudinaryService,
        private notifiService:NotificationsService

    ) { }

    /**
  /**
 * Creates a purchase record for a course and redirects the student
 * to the payment gateway.
 * If the student already owns the course, an exception is thrown.
 * If there is a pending or failed purchase, the existing purchase
 * is reused and the student is redirected to payment again.
 * @param studentId - The ID of the student.
 * @param courseId - The ID of the course to purchase.
 * @returns An object containing the payment gateway URL.
 * @throws NotFoundException If the course does not exist.
 * @throws BadRequestException If the student already owns the course.
 */
    public async buyCourse(studentId: number, courseId: number) {
        if (!studentId && courseId) throw new NotFoundException('Student Id Or Course Id Is Not Found')
        const course = await this.courseServise.getSingleCourse(courseId);
        if (!course) throw new NotFoundException('Course does not exist');
        const exist = await this.purchaseRepo.findOne({
            where: {
                course: { id: courseId },
                user: { id: studentId }

            }
        })
        const status = StatusEnum;
        if (exist) {
            switch (exist?.status) {
                case status.PAID:
                    throw new BadRequestException('You alrealdy own this course');
                case status.PENDING:
                    return {
                        message: 'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد'
                    }

                case status.FAILED: {
                    exist.status = status.PENDING;
                    await this.purchaseRepo.save(exist)
                    return {
                        message: 'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد'
                    }
                }
            }
        }
        const amount = course.discountPrice ?? course.price;
        const purchase = this.purchaseRepo.create({
            course: { id: courseId },
            user: { id: studentId },
            amount: amount,
            status: StatusEnum.PENDING

        })
       const pur= await this.purchaseRepo.save(purchase);
     
        return {
            message: 'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد'
        }
    }

    /**
     * confirm payment from student
     * @param id 
     * @param dto 
     * @returns wateing for approved message
     */

    public async confirmCheckOut(courseId: number, dto: ConfirmCheckoutDto, userId: number, file: any) {
        if (!courseId || !dto || !userId) throw new BadRequestException('some required values are missed');
        const paymentMethode: PaymentMethoeEnum = dto.paymentMethod;
        const transaction: string = dto.transactionId;
        if (!courseId || !paymentMethode || !transaction || !userId) throw new BadRequestException('some require value is missed');
        const purchase = await this.purchaseRepo.findOne({
            where: {
                course: { id: courseId }, user: { id: userId }
            }, relations: { user: true }, select: { user: { id: true } ,course:{id:true,title:true,Instractor:{id:true}}}
        })
        if (!purchase) throw new NotFoundException('Purchase Not Fond');
        const purchaseStatus = purchase.status;
        if (purchaseStatus == StatusEnum.PAID || purchaseStatus == StatusEnum.WAITING_APPROVAL) throw new NotFoundException('Purchase Already Paid');
        const image = await this.cloudService.uploadFile(file, 'course/images', 'image');
        console.log(purchase.user.id);
        if (purchase.user.id != userId) throw new UnauthorizedException('You Can not Access That Purchase')
        purchase.status = StatusEnum.WAITING_APPROVAL;
        purchase.transactionId = transaction;
        purchase.paymentMethod = paymentMethode;
        purchase.thumbnail = image.secure_url;
        purchase.publicId = image.public_id;
        
         await this.purchaseRepo.save(purchase);
        //creating notification for instractor
         const purchaseId=purchase.id; const courseTitle=purchase.course.title; const user_id=purchase.course.Instractor.id
        await this.notifiService.creatNotification(
        purchaseId,user_id,
        `طلب جديد `,
        `طلب جديد لكورس  ${courseTitle} اضغظ للتفاصيل `,
        NotificationType.PURCHASE
        )
        
    }


    public async getInsPurchase(insId: number, status?: StatusEnum) {
        const query = { ...(status ? { status: status } : {}), course: { Instractor: { id: insId } } };
        const purchases = await this.purchaseRepo.find({
            where: query, relations: {
                user: true,
                course: true
            }, select: {
                user: {
                    fullName: true,
                    email: true
                }, course: {
                    title: true,
                    id: true,
                    discountPrice: true,
                    price: true,
                    thumbnail: true,
                }
            }
        })
        return purchases;
    }


    public async updatPurchaseStatus(purchaseId: number, status: StatusEnum, insId: number) {
        if (!status || !purchaseId || !insId) throw new BadRequestException('Status or id  have not sended');
        const purchase = await this.purchaseRepo.findOne({
            where: {
                id: purchaseId
            }, relations: {
                course: {
                    Instractor: true
                },
                user: true
            }, select: {
                course: {
                    id: true,
                    title:true,
                    Instractor: {
                        id: true
                    }
                }, user: {
                    id: true
                }
            }
        })
        if (!purchase) throw new NotFoundException('Not Found');
        if (purchase?.course.Instractor.id != insId) throw new UnauthorizedException('You Can Not Access That');
        purchase.status = status ?? purchase.status;
        let title=``;
        let message=``;
        await this.purchaseRepo.save(purchase);
        switch (status) {
            case StatusEnum.FAILED: {
             title=`تحديث جديد`;
             message =`تم رفض  طلب اشتراكك في كورس ${purchase.course.title} الرجاء التواصل مع صاحب الكورس `
             return {message:'تم التحديث بنجاح'}
            };
            case StatusEnum.PAID: {
             
    
                 title=`تحديث جديد`;
                message =`تم قبول  طلب اشتراكك في كورس ${purchase.course.title} يمكنك الان  البدء في الكورس`
       
                return {
                    message: 'Purchase Updated Successfully & Student emrollmented successfully'
                }
            }
        }
         //creating notification for student
         await this.purchaseRepo.save(purchase);
         const courseId=purchase.course.id; const courseTitle=purchase.course.title; const user_id=purchase.user.id
        await this.notifiService.creatNotification(
        courseId,user_id,
        title,
        message,
        NotificationType.PURCHASE
        )
  
     await this.enrollService.enrollCourse(purchase.course.id, purchase.user.id);

    }



    /**
     *  get all purchase for instractor
     * @param instractorId 
     * @param status 
     * @returns 
     */
    public async getPendingPurchase(instractorId: number, status?: StatusEnum) {
        const query = { ...(status ? { status: status } : {}), course: { Instractor: { id: instractorId } } }
        const purchases = await this.purchaseRepo.find({
            where: query
        });
        return purchases;
    }


    //get Last purchase

    public async getLastPendingPurchase(insId: number) {
        const last = await this.purchaseRepo.find({
            where: { course: { Instractor: { id: insId } }, status: StatusEnum.WAITING_APPROVAL }
            , take: 2, order: { enrolledAt: 'ASC' }, relations: { user: true, course: true },
            select: { user: { id: true, fullName: true, avatar: true }, course: { title: true, discountPrice: true, price: true } }
        })
        return last;
    }

    // geting count of purchaseing
    public async getPurchaseNum(instractorId: number) {
        const purchases = await this.purchaseRepo.count({
            where: { course: { Instractor: { id: instractorId } } }
        });
        const pendingPurshace = await this.purchaseRepo.count({
            where: { course: { Instractor: { id: instractorId } }, status: StatusEnum.WAITING_APPROVAL }
        })
        return {
            totalPurchase: purchases, wateing_aproave: pendingPurshace
        };
    }


    // get total profite

    async getTotalProfite(instractorId: number) {
        const total = await this.purchaseRepo.createQueryBuilder('purchase')
            .innerJoin('purchase.course', 'course')
            .where('course.instractorId=:instractorId', { instractorId })
            .andWhere('purchase.status=:status', { status: StatusEnum.PAID })
            .select('SUM(purchase.amount)', 'totalAmount').getRawOne();
        return total.totalAmount;

    }

    public async getMostCoursePurchased(insId: number) {
        const mostCoursePurshaced = await this.purchaseRepo.createQueryBuilder('purchase')
            .innerJoin('purchase.course', 'course').where('course.instractorId =:insId', { insId })
            .andWhere('purchase.status=:status', {
                status: StatusEnum.PAID
            }).select('course.id', 'courseId').addSelect('course.title', 'courseTitle').addSelect('course.price', 'coursePrice')
            .addSelect('COUNT(purchase.id)', 'purchaseCount').groupBy('course.id').addGroupBy('course.title').orderBy('"purchaseCount"', 'DESC').limit(1).getRawOne();
        return mostCoursePurshaced;
    }


}