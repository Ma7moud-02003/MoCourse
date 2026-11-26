import { assertImageFile } from 'src/utils/upload-validation';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PurchaseEntity } from './purchase.entity';
import { QueryFailedError, Repository } from 'typeorm';
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
        if (!studentId || !courseId) throw new NotFoundException('Student Id Or Course Id Is Not Found')
        const course = await this.courseServise.getSingleCourse(courseId);
        if (!course) throw new NotFoundException('Course does not exist');
        // a draft course cannot be bought
        if (course.isPublished === false) throw new NotFoundException('Course does not exist');
        // a student who is already enrolled never gets a new purchase request
        if (await this.enrollService.verifyStudentEnrollment(studentId, courseId)) {
            throw new BadRequestException('You alrealdy own this course');
        }
        const exist = await this.purchaseRepo.findOne({
            where: {
                course: { id: courseId },
                user: { id: studentId }

            }
        })
        // one purchase request per student and course (database rule): a repeat request follows the existing one
        if (exist) return await this.answerForExistingPurchase(exist);
        const amount = course.discountPrice ?? course.price;
        const purchase = this.purchaseRepo.create({
            course: { id: courseId },
            user: { id: studentId },
            amount: amount,
            status: StatusEnum.PENDING

        })
        try {
            await this.purchaseRepo.save(purchase);
        } catch (err) {
            // two requests arrived together: the other one created the row first, so follow it
            if (err instanceof QueryFailedError && (err.driverError as { code?: string })?.code == '23505') {
                const winner = await this.purchaseRepo.findOne({ where: { course: { id: courseId }, user: { id: studentId } } });
                if (winner) return await this.answerForExistingPurchase(winner);
            }
            throw err;
        }

        return {
            message: 'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد'
        }
    }

    /** The answer for a student who already has a purchase request for this course (no second request is created). */
    private async answerForExistingPurchase(exist: PurchaseEntity) {
        const status = StatusEnum;
        switch (exist.status) {
            case status.PAID:
                throw new BadRequestException('You alrealdy own this course');
            case status.WAITING_APPROVAL:
                return {
                    message: 'طلبك قيد المراجعة من المدرس'
                }
            case status.FAILED:
                // a rejected request can be retried: the same request goes back to PENDING (only if it is still rejected)
                await this.purchaseRepo.update({ id: exist.id, status: status.FAILED }, { status: status.PENDING });
                return {
                    message: 'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد'
                }
            default:
                return {
                    message: 'اذهب للدفع ثم اضف بيانات الدفع وانتظر التاكيد'
                }
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
            }, relations: { user: true, course: { Instractor: true } }, select: { user: { id: true } ,course:{id:true,title:true,Instractor:{id:true}}}
        })
        if (!purchase) throw new NotFoundException('Purchase Not Fond');
        const purchaseStatus = purchase.status;
        if (purchaseStatus == StatusEnum.PAID || purchaseStatus == StatusEnum.WAITING_APPROVAL) throw new NotFoundException('Purchase Already Paid');
        assertImageFile(file, 'Payment screenshot');
        const image = await this.cloudService.uploadFile(file, 'course/images', 'image');
        if (purchase.user.id != userId) throw new UnauthorizedException('You Can not Access That Purchase')
        // only a request that is still PENDING (or rejected, being retried) can move to WAITING_APPROVAL: a stale or
        // repeated submission can never overwrite a decision the instructor made in the meantime
        let submitted;
        try {
            submitted = await this.purchaseRepo.createQueryBuilder().update(PurchaseEntity)
                .set({ status: StatusEnum.WAITING_APPROVAL, transactionId: transaction, paymentMethod: paymentMethode, thumbnail: image.secure_url, publicId: image.public_id })
                .where('id = :id AND status IN (:...open)', { id: purchase.id, open: [StatusEnum.PENDING, StatusEnum.FAILED] })
                .execute();
        } catch (e) {
            // nothing was saved, so the file just uploaded is not referenced by any row
            await this.cloudService.destroyAsset(image.public_id);
            throw e;
        }
        if (!submitted.affected) {
            // this request lost the race: delete ONLY the file it just uploaded (its own public_id).
            // The winner's proof and any earlier proof are different public_ids and are never touched.
            await this.cloudService.destroyAsset(image.public_id);
            throw new BadRequestException('This purchase was already submitted');
        }
        //creating notification for instractor
         const purchaseId=purchase.id; const courseTitle=purchase.course.title; const user_id=purchase.course.Instractor.id
        // the proof is already saved: a notification problem must not turn a saved submission into an error
        try {
            await this.notifiService.creatNotification(
                purchaseId, user_id,
                `طلب جديد `,
                `طلب جديد لكورس  ${courseTitle} اضغظ للتفاصيل `,
                NotificationType.PURCHASE
            );
        } catch (e) {
            console.error('notification failed after payment proof submit', e);
        }
        
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
        // the instructor can only accept or reject a purchase
        if (status !== StatusEnum.PAID && status !== StatusEnum.FAILED) {
            throw new BadRequestException('Status must be PAID or FAILED');
        }
        // Everything that changes data runs in ONE transaction: if enrolling or saving the status fails,
        // both are rolled back (no unpaid enrollment, no PAID purchase without access).
        const info = await this.purchaseRepo.manager.transaction(async (manager) => {
            const repo = manager.getRepository(PurchaseEntity);
            // lock the purchase row so two simultaneous approvals run one after the other
            const locked = await repo.findOne({ where: { id: purchaseId }, lock: { mode: 'pessimistic_write' } });
            if (!locked) throw new NotFoundException('Not Found');
            const purchase = await repo.findOne({
                where: { id: purchaseId },
                relations: { course: { Instractor: true }, user: true },
                select: {
                    course: { id: true, title: true, Instractor: { id: true } },
                    user: { id: true }
                }
            });
            if (!purchase) throw new NotFoundException('Not Found');
            if (purchase.course.Instractor.id != insId) throw new UnauthorizedException('You Can Not Access That');
            // only a purchase that the student submitted proof for can be reviewed (checked after the lock)
            if (locked.status !== StatusEnum.WAITING_APPROVAL) {
                throw new BadRequestException('Only purchases waiting for approval can be updated');
            }
            const courseId = purchase.course.id;
            const studentId = purchase.user.id;
            if (status === StatusEnum.PAID) {
                await this.enrollService.enrollCourseInTransaction(manager, courseId, studentId);
            }
            await repo.update(purchaseId, { status });
            return { courseId, studentId, courseTitle: purchase.course.title };
        });

        // notifications run after the commit; a notification problem must not undo the decision
        const paid = status === StatusEnum.PAID;
        try {
            await this.notifiService.creatNotification(
                info.courseId, info.studentId,
                `تحديث جديد`,
                paid
                    ? `تم قبول  طلب اشتراكك في كورس ${info.courseTitle} يمكنك الان  البدء في الكورس`
                    : `تم رفض  طلب اشتراكك في كورس ${info.courseTitle} الرجاء التواصل مع صاحب الكورس `,
                NotificationType.PURCHASE
            );
        } catch (e) {
            console.error('notification failed after purchase update', e);
        }
        return paid
            ? { message: 'Purchase Updated Successfully & Student emrollmented successfully' }
            : { message: 'تم التحديث بنجاح' };
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
        // SUM is NULL when there are no paid purchases: report "0" (same string type as a non-empty SUM, which pg returns as text)
        return String(total?.totalAmount ?? 0);

    }

    public async getMostCoursePurchased(insId: number) {
        const mostCoursePurshaced = await this.purchaseRepo.createQueryBuilder('purchase')
            .innerJoin('purchase.course', 'course').where('course.instractorId =:insId', { insId })
            .andWhere('purchase.status=:status', {
                status: StatusEnum.PAID
            }).select('course.id', 'courseId').addSelect('course.title', 'courseTitle').addSelect('course.price', 'coursePrice')
            .addSelect('COUNT(purchase.id)', 'purchaseCount').groupBy('course.id').addGroupBy('course.title').orderBy('"purchaseCount"', 'DESC').addOrderBy('course.id', 'ASC').limit(1).getRawOne();
        return mostCoursePurshaced;
    }


}
