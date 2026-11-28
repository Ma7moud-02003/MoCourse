import { pdfMaxBytes } from 'src/common/upload/upload.config';
import { readFile } from 'fs/promises';
import { assertPdfFile } from 'src/utils/upload-validation';
import { BadRequestException, ForbiddenException, forwardRef, Inject, Injectable,
NotFoundException, PayloadTooLargeException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessonsEntity } from './lessons.entity';
import { assertNoExamAttempts } from 'src/quiz/exam-guard';
import { Repository } from 'typeorm';
import { CreateLessonDto } from './dtos/lessin.dto';
import { SectionService } from 'src/section/section.service';
import { CourseService } from 'src/course/course.service';
import { UpdateLessonDto } from './dtos/updateLesson.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { LessonType } from 'src/utils/enums/lessonType.enum';
import { UploadApiResponse } from 'cloudinary';
import { EnrollmentService } from 'src/enrollment/enrollment.service';


@Injectable()
export class LessonService {
    constructor(
        @InjectRepository(LessonsEntity)
        private lessonRepo: Repository<LessonsEntity>,
        private sectionService: SectionService,
        @Inject(forwardRef(() => CourseService))
        private courseService: CourseService,
        private cloudinaryService: CloudinaryService,
        private enrollService: EnrollmentService,


    ) { }

    /**
     * add new lesson
     * @param dto 
     * @param insId 
     * @returns 
     */
    public async addLesson(dto: CreateLessonDto, insId: number) {
        if (!insId || !dto.title  || !dto.sectionId || !dto.type) throw new BadRequestException('Required Values are not Provided');
        await this.assertInstractorOwnsSection(dto.sectionId, insId)
        // creation
        const lesson = this.lessonRepo.create({
            ...dto,
            section: { id: dto.sectionId }
        })
        return await this.lessonRepo.save(lesson);

    }


    public async getLesson(lessonId: number, userId: number, role?: UserRoles) {
        if (!lessonId || !userId) throw new BadRequestException();
        const lesson = await this.lessonRepo.findOne({
            where: { id: lessonId }, relations: { section: true }, select: { section: { id: true } }
        });
        if (!lesson) throw new NotFoundException('Lesson Not Found');
        const sectionId = lesson?.section.id;
        if (!sectionId) throw new BadRequestException('No Section Is Found To This Lesson');
        // a draft course's lessons (even previews) are visible only to its owner or an already enrolled student
        const sectionForCourse = await this.sectionService.getSection(sectionId);
        const lessonCourseId = sectionForCourse?.course.id;
        if (!lessonCourseId) throw new BadRequestException();
        if (!(await this.courseService.canViewCourse(lessonCourseId, userId, role))) throw new NotFoundException('Lesson Not Found');
        if (lesson.isPreview) return this.withPlayback(lesson);
        const isUserOwnTheCourse = await this.verifyInstractorPeriorty(sectionId, userId);
        if (isUserOwnTheCourse) return this.withPlayback(await this.lessonRepo.findOne({ where: { id: lessonId } }));
        const section = await this.sectionService.getSection(sectionId);
        const courseId = section?.course.id;
        if (!courseId) throw new BadRequestException();
        const verifyed = await this.verifyStudentEnrollment(userId, courseId);
        if (verifyed) return this.withPlayback(lesson);
        if (lesson?.isPreview) return this.withPlayback(lesson);
        const enroll = await this.verifyStudentEnrollment(userId, courseId);
        if (!enroll) throw new UnauthorizedException('You need to purchase this course');
        return this.withPlayback(lesson);
    }

    /** A copy of the lesson whose videoUrl is the playable (signed) link. Never saved back to the database. */
    private withPlayback<T extends { videoUrl?: string; videoPublicId?: string } | null>(lesson: T): T {
        if (!lesson) return lesson;
        return { ...lesson, videoUrl: this.cloudinaryService.videoPlaybackUrl(lesson.videoUrl, lesson.videoPublicId) } as T;
    }


    public async getSectiionLessons(sectionId: number, userId: number, role?: UserRoles) {
        if (!sectionId || !userId) throw new BadRequestException();
        const listSection = await this.sectionService.getSection(sectionId);
        if (!listSection) throw new BadRequestException('No section Provided');
        // a draft course's lesson list is visible only to its owner or an already enrolled student
        if (!(await this.courseService.canViewCourse(listSection.course.id, userId, role))) throw new NotFoundException('Section not found');
        const vrified = await this.verifyInstractorPeriorty(sectionId, userId);
        if (vrified) {
            const own = await this.lessonRepo.find({
            where: { section: { id: sectionId } },
            order: { order: 'ASC' }
        });
            return own.map((l) => this.withPlayback(l));
        }
        return await this.lessonRepo.find({
            where: { section: { id: sectionId } },
            select: { id: true, isPreview: true, order: true, title: true, duration: true }
            , order: { order: 'ASC' }
        });
    }


    async updateLessone(lessonId: number, dto: UpdateLessonDto, insId: number) {
        if (!lessonId) throw new BadRequestException();
        const lesson = await this.lessonRepo.findOne({
            where: { id: lessonId }, relations: { section: true }, select: { section: { id: true } }
        })
        if (!lesson) throw new NotFoundException('Lesson Not Found');
        await this.assertInstractorOwnsSection(lesson.section.id, insId);
        lesson.title = dto.title ?? lesson.title;
        lesson.description = dto.description ?? lesson.description;
        lesson.order = dto.order ?? lesson.order;
        lesson.type = dto.type ?? lesson.type;
        lesson.content = dto.content ?? lesson.content;
        lesson.isPreview = dto.isPreview ?? lesson.isPreview;
        return await this.lessonRepo.save(lesson);

    }


     async deleteLesson(lessonId: number, insId: number) {
        if (!lessonId || !insId) throw new BadRequestException('Required values are not provided');
        const lesson = await this.lessonRepo.findOne({
            where: { id: lessonId }, relations: { section: true }, select: { section: { id: true } }
        })
        if (!lesson) throw new NotFoundException('Lesson Not Found');
        await this.assertInstractorOwnsSection(lesson.section.id, insId);
        // exams linked to a lesson (legacy data) are deleted with it: refuse if a student attempted one
        return await this.lessonRepo.manager.transaction(async (manager) => {
            await assertNoExamAttempts(manager, { lesson: { id: lessonId } }, 'Students already attempted an exam in this lesson, so it cannot be deleted');
            return await manager.remove(lesson);
        });
    }

    // uploade Part 
    async updateLesson_Upload(file: Express.Multer.File, lessonId: number, insId: number) {
        if (!file || !lessonId || !insId) throw new BadRequestException('Required values are not provided');
        const lesson = await this.lessonRepo.findOne({
            where: { id: lessonId }, relations: { section: true }, select: { section: { id: true } }
        })
        if (!lesson) throw new NotFoundException('Lesson Not Found');
        await this.assertInstractorOwnsSection(lesson.section.id, insId);
        let resulte: UploadApiResponse;
        switch (lesson.type) {
            case LessonType.VIDEO: {
                if (!file.mimetype.startsWith('video/')) throw new BadRequestException('This lessen type acccept only Vido')
                if (file.path) {
                    // disk-backed upload: streamed from the temp file, never fully in memory
                    const video = await this.cloudinaryService.uploadVideoFromPath(file.path, 'course/vidoes');
                    lesson.videoUrl = video.url;
                    lesson.videoPublicId = video.publicId;
                    lesson.duration = video.durationSeconds;
                } else {
                    resulte = await this.cloudinaryService.uploadFile(file, 'course/vidoes', 'video');
                    lesson.videoUrl = resulte.secure_url;
                    lesson.videoPublicId = resulte.public_id;
                    lesson.duration = Math.round(resulte.duration)
                }
                break
            }
            case LessonType.PDF: {
                // PDFs have their own limit (PDF_MAX_UPLOAD_BYTES), checked before the file is read into memory
                if ((file.size ?? file.buffer?.length ?? 0) > pdfMaxBytes()) throw new PayloadTooLargeException('PDF is too large');
                if (file.path && !file.buffer) file = { ...file, buffer: await readFile(file.path) };
                assertPdfFile(file);
                resulte = await this.cloudinaryService.uploadFile(file, 'course/pdfs', 'raw');
                lesson.pdfUrl = resulte.secure_url;
                lesson.pdfPublicId = resulte.public_id;
                break;
            }
            default: throw new BadRequestException('This lesson does not support file upload');
        }
        return await this.lessonRepo.save(lesson);

    }

    // verify if student enrolls the course 
    public async verifyStudentEnrollment(userId: number, courseId: number) {
        return await this.enrollService.verifyStudentEnrollment(userId, courseId);
    }


    // throws if the instructor does not own the course of this section
    public async assertInstractorOwnsSection(sectionId: number, insId: number) {
        const owns = await this.verifyInstractorPeriorty(sectionId, insId);
        if (!owns) throw new ForbiddenException('You are not allowed to modify this course');
    }

    // verify if ins is the owner of the course
    public async verifyInstractorPeriorty(sectioId: number, insId: number) {
        const section = await this.sectionService.getSection(sectioId);
        if (!section) throw new BadRequestException('No section Provided');
        const courseId = section.course.id;

        const course = await this.courseService.getSingleCourse(courseId);
        if (!course) throw new BadRequestException('Course is not found');
        return course.Instractor.id === insId;
    }

    // get section id for lesson by id  no route handler just in development
    public async getLessonSectionId(lessonId: number) {
        const lesson = await this.lessonRepo.findOne({
            where: { id: lessonId }, relations: { section: true }, select: { section: { id: true } }
        })
        return lesson?.section.id;
    }

    public async getLessonForDeveopment(lessonId: number) {
        return await this.lessonRepo.findOne({
            where: { id: lessonId }, relations: { section: true }, select: { section: { id: true } }
        })
    }

    

    // return lessons count 
    public async getLessonsCout(courseId: number) {
        return await this.lessonRepo.count({
            where: {
                section: {
                    course: {
                        id: courseId
                    }
                }
            }
        })
    }


    public async getCourseByLessonId(lessonId:number){
const lesson=await this.lessonRepo.findOne({
    where:{id:lessonId},relations:{section:{course:{Instractor:true}}}
})
return lesson?.section.course;
    }

}
