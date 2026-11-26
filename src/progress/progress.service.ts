import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ProgressEntity } from './progress.entity';
import { Repository } from 'typeorm';
import { CreatProgressDto } from './creatProg.dto.ts/creatProg.dto';
import { LessonService } from 'src/lesson/lesson.service';
import { SectionService } from 'src/section/section.service';
import { UpdateProgressDto } from './creatProg.dto.ts/updateProg.dto';
import { EnrollmentService } from 'src/enrollment/enrollment.service';

@Injectable()
export class ProgressService {
    private readonly logger = new Logger(ProgressService.name);
    constructor(
        @InjectRepository(ProgressEntity)
        private progressRepo: Repository<ProgressEntity>,
        private lessonService: LessonService,
        private sectionService: SectionService,
        private enrollService: EnrollmentService) { }

    public async createProgress(dto: CreatProgressDto, userId: number) {
        const { lessonId } = dto;
        if (!userId || !lessonId) throw new BadRequestException();
        const verifyed = await this.verifyStudentEnrollment(dto.lessonId, userId)
        if (!verifyed) throw new UnauthorizedException()
        const progress = this.progressRepo.create({
            user: { id: userId },
            lesson: { id: lessonId }
        })
        return await this.progressRepo.save(progress);
    }

    /**
     *  get single progress for each student and creat one if not created
     * @param lessonId 
     * @param userId 
     * @returns  student progress if enorlls
     */
    public async getSingleProgress(lessonId: number, userId: number) {
        const verifyed = await this.verifyStudentEnrollment(lessonId, userId);
        if (!verifyed) throw new UnauthorizedException('You Need To Purchase This Course Frist');
        let progress = await this.progressRepo.findOne({
            where: { lesson: { id: lessonId }, user: { id: userId } }
        })
        if (!progress) { progress = await this.createProgress({ lessonId }, userId) }
        return progress;
    }

    /**
     * Updateing Progress in lesseon for student
     * @param dto 
     * @param userId 
     * @returns  new updated progress
     */
    public async updateProgress(dto: UpdateProgressDto, userId: number) {
        if (dto.lastPosition == null || !dto.lessonId) throw new BadRequestException();
        const progress = await this.getSingleProgress(dto.lessonId, userId);
        const lesson = await this.lessonService.getLessonForDeveopment(dto.lessonId);
        if (!lesson) throw new BadRequestException();
        if (!lesson.duration) throw new BadRequestException();
        const persentage = (dto.lastPosition * 100) / lesson.duration;
        progress.lastPosition = Math.max(
            progress.lastPosition,
            dto.lastPosition
        );
        if (persentage >= 90) {
            progress.completed = true;
            progress.completedAt ??= new Date();
            await this.progressRepo.save(progress);
            const sectionId = lesson.section.id;
            const section = await this.sectionService.getSection(sectionId);
            if (!section) return;
            const courseId = section.course.id;
            const courseProgress = await this.getCourseProgress(courseId, userId);
            const persentage = courseProgress.persentage;
            if (persentage >= 90) {
                // The lesson progress is already saved above, so a problem while completing the course must not turn
                // this request into an error. It is awaited (no unhandled rejection that can stop the server) and
                // logged.
                try {
                    await this.enrollService.updateEnrollStatus(courseId, userId);
                } catch (e) {
                    this.logger.error(`Completing course ${courseId} for student ${userId} failed: ${(e as Error)?.message}`, (e as Error)?.stack);
                }
            };
            return progress;
        }
        return await this.progressRepo.save(progress);
    }


    /**
     * verify if student own this course
     * @param lessonId 
     * @param userId 
     * @returns  true or false 
     */
    public async verifyStudentEnrollment(lessonId: number, userId: number) {
        const sectionId = await this.lessonService.getLessonSectionId(lessonId);
        if (!sectionId) throw new BadRequestException();
        const section = await this.sectionService.getSection(sectionId);
        if (!section) throw new BadRequestException();
        const courseId = section.course.id;
        if (!courseId) throw new BadRequestException();
        const verifyed = await this.lessonService.verifyStudentEnrollment(userId, courseId);
        return !!verifyed;
    }

    /**
     *  get number of lessons in the course
     * @param userId 
     * @param courseId 
     * @returns  number of lessons
     */
    public async getCompletedLessensCount(userId: number, courseId: number) {
        return await this.progressRepo.count({
            where: {
                user: { id: userId },
                completed: true, lesson: {
                    section: {
                        course: { id: courseId }
                    }
                }
            }
        })
    }

    /**
     * progress of one student in a course, for the course's own instructor
     */
    public async getStudentProgressForInstructor(courseId: number, studentId: number, insId: number) {
        await this.enrollService.assertInstructorCanViewStudent(courseId, studentId, insId);
        return await this.getCourseProgress(courseId, studentId);
    }

    /**
     *  getting progress of entire course 
     * @param courseId 
     * @param userId 
     * @returns  number of progressing 
     */
    public async getCourseProgress(courseId: number, userId: number) {
        if (!courseId || !userId) throw new BadRequestException();
        const completedLessons = await this.getCompletedLessensCount(userId, courseId);

        const lessonsCount = await this.lessonService.getLessonsCout(courseId);
        if (!lessonsCount) throw new BadRequestException();
        const persentage = (completedLessons * 100) / lessonsCount;
        return { totalLesoons: lessonsCount, completedLessons: completedLessons, persentage }
    }

    

/** instractor dashboared
 * getting most completed lesson
 * @param insId 
 * @returns lesson
 */
    public async getMostCompletedLesson(insId: number) {
        const mostWatched = await this.progressRepo.createQueryBuilder('progress').
            innerJoin('progress.lesson', 'lesson').innerJoin('lesson.section', 'section').innerJoin('section.course', 'course')
            .where('course.instractorId=:insId', { insId }).andWhere('progress.completed=:completed', {
                completed: true
            }).select('lesson.id', 'lessonId').addSelect('lesson.title', 'lessonTitle').addSelect('COUNT(progress.id)', 'watchedCount')
            .groupBy('lesson.id').limit(1).orderBy('"watchedCount"', 'DESC').addOrderBy('lesson.id', 'ASC').getRawOne();
        return mostWatched;
    }

    /**
     * get Last lesson to continu learning 
     * @param studentId 
     * @returns last lesson 
     */
    public async getLastLessonForStudnt(studentId:number){
     const lastLesson =await this.progressRepo.findOne({
        where:{user:{id:studentId}},order:{updatedAt:'DESC',id:'DESC'},relations:{lesson:true},select:{lesson:{
            title:true,id:true,order:true
        }}
     }
     )
     return lastLesson;

    }
}
