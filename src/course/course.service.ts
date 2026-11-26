import { assertImageFile } from 'src/utils/upload-validation';
import { BadRequestException, ConflictException, forwardRef, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CouurseDto } from './dtos/course.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { InjectRepository } from '@nestjs/typeorm';
import { CourseEntity } from './course.entity';
import { Between, In, LessThanOrEqual, Like, MoreThanOrEqual, Repository } from 'typeorm';
import { QuizEntity } from 'src/quiz/quiz.entity';
import { QuizAttemptEntity } from 'src/quiz-attempt/quiz-attemp.entity';
import { PayloadType } from 'src/utils/types/paylod.type';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { UpdateCouurseDto } from './dtos/updateCourse.dto';
import { CourseLevel } from 'src/utils/enums/level.enum';
import { EnrollmentService } from 'src/enrollment/enrollment.service';



// undefined/empty -> undefined (leave unchanged); true/'true'/'1' -> true; false/'false'/'0' -> false
export function parsePublished(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    const v = String(value).trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
    throw new BadRequestException('isPublished must be true or false');
}

// either bound may be sent alone; 0 is a valid bound; NaN/undefined means not sent
export function priceFilter(minPrice?: number, maxPrice?: number) {
    const hasMin = typeof minPrice === 'number' && !Number.isNaN(minPrice);
    const hasMax = typeof maxPrice === 'number' && !Number.isNaN(maxPrice);
    if (hasMin && hasMax) return { price: Between(minPrice, maxPrice) };
    if (hasMin) return { price: MoreThanOrEqual(minPrice) };
    if (hasMax) return { price: LessThanOrEqual(maxPrice) };
    return {};
}

@Injectable()
export class CourseService {
    constructor(
        @InjectRepository(CourseEntity)
        private courseRepo: Repository<CourseEntity>,
        private cloudinaryServive: CloudinaryService,
       @Inject(forwardRef(() => EnrollmentService))
       private readonly enrollService: EnrollmentService
      
    ) {

    }
    /**
     * add new course
     * @param dto 
     * @param file 
     * @param insId 
     * @returns  course created 
     */

    public async addNewCourse(dto: CouurseDto, file: Express.Multer.File, insId: number) {
        assertImageFile(file, 'Thumbnail');
        const image = await this.cloudinaryServive.uploadFile(file, 'course/images', 'image');
        const course = this.courseRepo.create({
            title: dto.title,
            describtion: dto.describtion,
            price: dto.price,
            thumbnail: image.secure_url,
            discountPrice: dto.discountPrice,
            Instractor: { id: insId },
            duration: dto.duration,
            isPublished:dto.isPublished,
            publicId: image.public_id,
            covers: dto.covers,
            level: dto.level,
            requirements: dto.requirements,
            category: { id: dto.categoryId }
        })
        return this.courseRepo.save(course);
    }

    /**
     * get single course by id
     * @param courseId 
     * @returns course 
     */
    public async getSingleCourse(courseId: number) {
        const course = await this.courseRepo.findOne({
            where: {
                id: courseId
            }, relations: {
            
                Instractor: true,
                category: true
            }, select: {
                Instractor: {
                    id: true
                },
                category: {
                    id: true
                }
            }
        })
        if (!course) throw new NotFoundException('Course not found with this id');
        return course;
    }



    /**
     * Update Course bt instractor
     * @param updateDto 
     * @param courseId 
     * @param insId 
     * @param file 
     * @returns updated course
     */
    public async updateCourse(updateDto: UpdateCouurseDto, courseId: number, insId: number, role: UserRoles, file?: Express.Multer.File) {
        if (!updateDto || !courseId || !insId) throw new BadRequestException('requred value are missed')
        let course = await this.getSingleCourse(courseId);
        if (role != UserRoles.ADMIN) {
            if (course.Instractor.id != insId) throw new UnauthorizedException('Access Denied You are not allowed to access this course');
        }
        if (file) {
            assertImageFile(file, 'Thumbnail');
            const image = await this.cloudinaryServive.uploadFile(file, 'course/images', 'image');
            course.thumbnail = image.secure_url ?? course.thumbnail;
            course.publicId = image.public_id ?? course.publicId
        }
        course.title = updateDto.title ?? course.title;
        course.describtion = updateDto.describtion ?? course.describtion;
        course.level = updateDto.level ?? course.level;
        course.duration = updateDto.duration ?? course.duration;
        course.price = updateDto.price ?? course.price;
        course.discountPrice = updateDto.discountPrice ?? course.discountPrice;
        course.covers = updateDto.covers ?? course.covers;
        course.requirements = updateDto.requirements ?? course.requirements;
        // keep the current state unless the request really sends one (multipart bodies send strings)
        course.isPublished = parsePublished(updateDto.isPublished) ?? course.isPublished;
        course.category.id = updateDto.categoryId ?? course.category.id
        return await this.courseRepo.save(course);
    }

    /**
     * Delete Course y Ins Or Admin
     * @param courseId 
     * @param insId 
     * @param role 
     * @returns Course Deleted
     */

    public async deleteCourse(courseId: number, insId: number, role: UserRoles) {
        if (!courseId || !insId || !role) throw new BadRequestException('requred value are missed');
        const course = await this.getSingleCourse(courseId);
        if (role != UserRoles.ADMIN) {
            if (course.Instractor.id != insId) throw new UnauthorizedException('Access Denied You are not allowed to access this course');
        }
        // a course delete cascades to its exams and their attempts: refuse if any student attempted
        // one. The exams are locked first so a student cannot start while the check runs.
        return this.courseRepo.manager.transaction(async (manager) => {
            // The course row is locked first. A student starting an exam takes a shared lock on the
            // same course row before the exam row, so a start cannot slip in between the check and the delete.
            const lockedCourse = await manager.findOne(CourseEntity, { where: { id: courseId }, select: { id: true }, lock: { mode: 'pessimistic_write' } });
            if (!lockedCourse) throw new NotFoundException('Course not found');
            const exams = await manager.find(QuizEntity, { where: { course: { id: courseId } }, select: { id: true }, order: { id: 'ASC' } });
            if (exams.length) {
                await manager.find(QuizEntity, { where: { id: In(exams.map((e) => e.id)) }, select: { id: true }, order: { id: 'ASC' }, lock: { mode: 'pessimistic_write' } });
                const attempts = await manager.count(QuizAttemptEntity, { where: { quiz: { course: { id: courseId } } } });
                if (attempts > 0) throw new ConflictException('Students already attempted an exam in this course, so it cannot be deleted');
            }
            // Other records (enrollments, payments, ...) still point at the course. The database refuses the
            // delete for those; answer with a clear 409 instead of a raw 500. This does not delete anything extra.
            try {
                return await manager.remove(course);
            } catch (e: any) {
                if ((e?.code ?? e?.driverError?.code) === '23503') {
                    throw new ConflictException('This course still has enrolled students or other linked records, so it cannot be deleted');
                }
                throw e;
            }
        });
    }

    /**
     *  get courses for signed students => it will be updated after that for filter and pagenation
     * @returns all courses
     */
    public async getAllCourses(title: string, categoryId?: number,
        minPrice?: number, maxPrice?: number, level?: CourseLevel, role?: UserRoles) {
        const query = {
            // drafts are hidden from the public list; admin sees everything
            ...(role === UserRoles.ADMIN ? {} : { isPublished: true }),
            ...(title ? { title: Like(`%${title}%`) } : {}),
            ...priceFilter(minPrice, maxPrice),
            ...(categoryId ? { category: { id: categoryId } } : {}),
            ...(level ? { level: level } : {})
        }
        return await this.courseRepo.find({
            where: query,
            relations: {
                category: true, Instractor: true
            },
            select: {
                id: true, title: true, price: true,
                discountPrice: true, thumbnail: true,
                createdAt: true,
                category: { name: true },
                Instractor: { id: true, fullName: true, avatar: true }
            }
        }
        );
    }


    /**
     *  get courses belongs to Instarctor => it will be updated after that for filter and pagenation
     * @returns all courses belongs to Instarctor
     */
    public async getInsCourses(payload: PayloadType) {
        if (!payload.id && !payload.role) throw new BadRequestException();
        const id = payload.id;
        
        return await this.courseRepo.find({
            where: { Instractor: { id } },
            relations: {
                Instractor: true,category:true
            },
            select: {
                id: true, title: true, duration: true,isPublished:true,
                 price: true, discountPrice: true, thumbnail: true, createdAt: true,category:{name:true,id:true}
            }
        });
    }

    /**
     *  Get coruse details for every one
     * @param courseId 
     * @returns  Course details
     */
    public async getCourseDetails(courseId: number,userId?:number,role?:UserRoles,enforceVisibility:boolean=false) {
        if (!courseId) throw new NotFoundException();
        let isEnrolled:boolean=false;
        let canAccess:boolean=false;


        const course = await this.courseRepo.findOne({
            where: { id: courseId },
            relations: {
                Instractor: true,
                category: true,
                quizzes:true
            }, select: {
                Instractor: {
                    id: true,
                    avatar: true,
                    fullName: true
                },
                quizzes:{
                    id:true,
                    title:true,
                    isPublished:true
                }
            }
        })
        if (!course) throw new NotFoundException();
        if(userId){
            canAccess=await this.verifyingInstractorOwnTheCourse(userId,courseId);
            if(canAccess) isEnrolled=false;
            else
            isEnrolled=await this.enrollService.verifyStudentEnrollment(userId,courseId);
        }
        
        // a draft course is visible only to its owner, an admin, or a student who already enrolled
        if (enforceVisibility && course.isPublished === false && !canAccess && !isEnrolled && role !== UserRoles.ADMIN) {
            throw new NotFoundException();
        }
        // draft exams are visible only to the course owner
        const quizzes = (course.quizzes ?? []).filter((q) => canAccess || q.isPublished);
        return {...course,quizzes,isEnrolled,canAccess};
    }

    /**
     * get courses Number belongs to instractor
     * @param instractorId 
     * @returns number of courses
     */
    public getCoursesCountBelongsToInstractor(instractorId: number) {
        const coursesCount = this.courseRepo.count({
            where: { Instractor: { id: instractorId } }
        });
        return coursesCount;
    }

   public async getSuggestedCourses(catId?:number){
  const suggestedCourses=await this.courseRepo.find({
    where:{category:{id:catId},isPublished:true},take:5
  })
  return suggestedCourses;
   }

   /**
    * true when this user may see the course content listing: published course, its owner, an admin,
    * or a student who already enrolled (kept after the teacher unpublishes)
    */
   public async canViewCourse(courseId:number,userId?:number,role?:UserRoles){
     const course = await this.getSingleCourse(courseId);
     if(course.isPublished!==false) return true;
     if(role===UserRoles.ADMIN) return true;
     if(!userId) return false;
     if(course.Instractor.id==userId) return true;
     return await this.enrollService.verifyStudentEnrollment(userId,courseId);
   }

   public async verifyingInstractorOwnTheCourse(insId:number,courseId:number){
     let course = await this.getSingleCourse(courseId);
     if(!course) return false;
    return course.Instractor.id == insId;
   }



}
