import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EnrollmentEntity } from './enrollment.entity';
import { EntityManager, Repository } from 'typeorm';
import { CourseService } from 'src/course/course.service';
import { EnrollmentStatus } from 'src/utils/enums/enroll.enum';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { CertificateService } from 'src/certificate/certificate.service';
import { NotificationType } from 'src/utils/enums/notification.enum';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class EnrollmentService {
    constructor(
        @InjectRepository(EnrollmentEntity)
        private enrollRepo:Repository<EnrollmentEntity>,
        private courseService:CourseService,
        private certificateService:CertificateService,
        private notifiService:NotificationsService
    ){}

    /**
     * enroll course afer checking existing and publishment
     * @param courseId 
     * @param studentId 
     * @returns enrolled successsfully
     */
async enrollCourse(courseId:number,studentId:number){
if(!courseId||!studentId) throw new BadRequestException();
const exist=await this.enrollRepo.findOne({where:{
    course:{id:courseId},
    user:{id:studentId}
}})
if(exist) throw new BadRequestException('You are alrealdy enroll this course');

const course=await this.courseService.getSingleCourse(courseId);
if(!course) throw new NotFoundException('Course is not existed')
if(!course.isPublished) throw new BadRequestException('Course is not Published Yet');
// One enrollment per student and course is enforced by the database. The insert ignores a conflict, so two
// requests arriving together create one row; the loser gets the same answer as a repeated request and the
// existing enrollment (status, progress) is left untouched.
const created=await this.insertEnrollmentIgnoringDuplicate(this.enrollRepo.manager,courseId,studentId);
if(!created) throw new BadRequestException('You are alrealdy enroll this course');
          //creating notification for instractor
 await this.notifiService.creatNotification(
               courseId,studentId,
               `اشتراك ناجح `,
              ` تم اشتركك بنجاح في كورس ${course.title}`,
               NotificationType.ENROLLMENT  
               )
                       
}

/**
 * INSERT ... ON CONFLICT ON CONSTRAINT "UQ_enrollments_user_course" DO NOTHING (only the one-enrollment-per-student-and-course rule). Never updates an existing row.
 * @returns true when a new row was inserted, false when the student was already enrolled
 */
private async insertEnrollmentIgnoringDuplicate(manager:EntityManager,courseId:number,studentId:number):Promise<boolean>{
const result=await manager.createQueryBuilder()
    .insert()
    .into(EnrollmentEntity)
    .values({course:{id:courseId},user:{id:studentId}})
    // names the one rule this is about: any other constraint violation still raises and rolls the transaction back
    .onConflict('ON CONSTRAINT "UQ_enrollments_user_course" DO NOTHING')
    .execute();
return result.raw.length>0;
}



/**
 * Enroll a student inside an existing database transaction (used when an instructor approves a purchase).
 * Uses the transaction manager so the enrollment is rolled back together with the purchase update.
 * @returns true if a new enrollment was created, false if the student was already enrolled
 */
async enrollCourseInTransaction(manager:EntityManager,courseId:number,studentId:number):Promise<boolean>{
if(!courseId||!studentId) throw new BadRequestException();
const repo=manager.getRepository(EnrollmentEntity);
const exist=await repo.findOne({where:{course:{id:courseId},user:{id:studentId}}});
if(exist) return false;
const course=await this.courseService.getSingleCourse(courseId);
if(!course) throw new NotFoundException('Course is not existed');
if(!course.isPublished) throw new BadRequestException('Course is not Published Yet');
// the purchase approval runs in a transaction: ON CONFLICT DO NOTHING keeps it alive when another request enrolled the student first
return await this.insertEnrollmentIgnoringDuplicate(manager,courseId,studentId);
}


/**
 * Getting Courses Belongs to students
 * @param studentId 
 * @returns Student Courses
 */
 public async getStudentCourses(studentId:number,status?:EnrollmentStatus){
if(!studentId) throw new BadRequestException('Id is not provided');
const q={...( status ?{status:status}:{})}
const courses=await this.enrollRepo.find({
    where:{user:{id:studentId},...q},relations:{
    course:true,    
    },select:{
        course:{
         id:true,thumbnail:true,title:true,createdAt:true,price:true,discountPrice:true,Instractor:true
        }
    }
});
if(courses.length==0) return [];
const progress=await this.getCoursesProgress(studentId,courses.map(e=>e.course?.id).filter(id=>id!=null));
return courses.map(e=>({...e,progressPercent:progress.get(e.course?.id)??0}));
 }

 /**
  * Percent of lessons the student completed, per course (0-100, whole number).
  * A course with no lessons is 0.
  */
 public async getCoursesProgress(studentId:number,courseIds:number[]){
const result=new Map<number,number>();
if(!courseIds.length) return result;
const rows:{courseId:number|string,total:number|string,done:number|string}[]=await this.enrollRepo.manager.query(
`SELECT s."courseId" AS "courseId", COUNT(l.id) AS total, COUNT(p.id) FILTER (WHERE p.completed = true) AS done
 FROM sections s
 JOIN lessons l ON l."sectionId" = s.id
 LEFT JOIN progreses p ON p."lessonId" = l.id AND p."userId" = $1
 WHERE s."courseId" = ANY($2)
 GROUP BY s."courseId"`,[studentId,courseIds]);
for(const r of rows){
const total=Number(r.total),done=Number(r.done);
result.set(Number(r.courseId),total>0?Math.round((done*100)/total):0);
}
return result;
 }

 public async verifyStudentEnrollment(studentId:number,courseId:number){
const enroll=await this.enrollRepo.findOne({
    where:{user:{id:studentId},course:{id:courseId}}
});
return !!enroll;
 }

 /**
  * An instructor may only read data of a student who is enrolled in one of the instructor's own courses.
  * Unknown course, a course owned by someone else and a student who is not enrolled all give the same 404,
  * so the answer does not reveal which of them it was.
  */
 public async assertInstructorCanViewStudent(courseId:number,studentId:number,insId:number){
if(!courseId||!studentId||!insId) throw new BadRequestException();
const course=await this.courseService.getSingleCourse(courseId);
if(course.Instractor.id!==insId) throw new NotFoundException('Student not found in this course');
const enrolled=await this.verifyStudentEnrollment(studentId,courseId);
if(!enrolled) throw new NotFoundException('Student not found in this course');
 }

 /**
  * Roster of a course: an admin sees every course, an instructor only their own.
  * Someone else's course gives the same 404 as a course that does not exist.
  */
 public async getCourseStudentsFor(courseId:number,userId:number,role?:UserRoles){
if(!courseId) throw new BadRequestException();
if(role!==UserRoles.ADMIN){
const course=await this.courseService.getSingleCourse(courseId);
if(course.Instractor.id!==userId) throw new NotFoundException('Course not found with this id');
}
return await this.getCourseStudents(courseId);
 }

 /**
  * get stusents whos enrolled that course
  * @param courseId 
  * @returns stusents
  */
 public async getCourseStudents(courseId:number){
if(!courseId) throw new BadRequestException();
const users=await this.enrollRepo.find({
    where:{
        course:{id:courseId }
    },relations:{user:true},select:{user:{
        id:true,
        fullName:true,
        avatar:true
    }}
});
if(users.length==0) return {messsage:'No Users Purchase this course'};
return users;
}

/**
 * get number of students who purchase this course
 * @param courseId 
 * @returns count of students
 */

public async getCourseStdentsCount(courseId:number){
const count=await this.enrollRepo.count({
 where:{course:{id:courseId}}   
})
return count;
}

/**
 * get number of students who purchase with the Instractor
 * @param  
 * @returns count of students
 */

public async getStudentsCountWithInstractor(instractorId:number){
if(!instractorId) throw new BadRequestException();
const count=await this.enrollRepo.count({
 where:{
    course:{
        Instractor:{
            id:instractorId
        }
    }
 }   
})
return count;
}

/**
 * Update Status By Instractor After Student Confirm checkout
 * @param courseId 
 * @param userId 
 * @returns  updated successfully message
 */
public async updateEnrollStatus(courseId:number,userId:number){
const enroll=await this.enrollRepo.findOne({
    where:{course:{id:courseId},user:{id:userId}},relations:{course:true},select:{course:{title:true}}
})
if(!enroll) return {
    message:'Enroll Is not Found'
};
  if (enroll.status === EnrollmentStatus.COMPLETED){
 // Already completed: make sure the certificate exists. This repairs a completion whose certificate step failed
 // (or an old completed enrollment without one). creatCertification does nothing when the certificate is already there.
 // The recorded completedAt is passed on as it is (it can be empty on old rows; no date is made up).
 await this.certificateService.creatCertification(userId,courseId,enroll.course.title,enroll.completedAt);
 return ;
 }
enroll.status=EnrollmentStatus.COMPLETED;
const completedAt=new Date();
enroll.completedAt=completedAt;
const courseTitle=enroll.course.title;
await this.enrollRepo.save(enroll);
await this.certificateService.creatCertification(userId,courseId,courseTitle,completedAt);
return {message:'تم اكمال الكورس  بنجاح الف الف مبروك'}
}

// نسبة انتهاء الطلاب من الكورسات 
public async getStudentsCourseCompletionRate(insId:number){
const total=await this.enrollRepo.count({
    where:{course:{Instractor:{id:insId}}}
});
const completed=await this.enrollRepo.count({
    where:{course:{Instractor:{id:insId}},status:EnrollmentStatus.COMPLETED}
});
if(total==0) return {totalStudents:0,completedStudents:0,completionPercentage:0};
return {
     totalStudents: total,
    completedStudents: completed,
    completionPercentage: (completed * 100) / total
}
}








/** dashboared
 * getting last courses  belongs to student
 * @param studentId 
 * @returns last  courses 
 */
public async getLastCoursesOfStudent(studentId:number){
const coursesCount=await this.enrollRepo.find({
    where:{
       user:{id:studentId}
    },relations:{course:true},select:{course:{
        id:true,title:true,thumbnail:true
    }}
    ,order:{enrolledAt:'DESC',id:'DESC'},take:2
})
return coursesCount;
}

/** dashboared
 * getting Persentage Of Completed Course to student
 * @param studentId 
 * @returns Persentage 
 */
public async getStudentCoursesCount(studentId:number){
const enrolldCount=await this.enrollRepo.count({
    where:{user:{id:studentId}}
});
const completedCourse=await this.enrollRepo.count({
    where:{user:{id:studentId},status:EnrollmentStatus.COMPLETED}
});
const inProgress=await this.enrollRepo.count({
    where:{user:{id:studentId},status:EnrollmentStatus.IN_PROGRESS}
});

const persentage=enrolldCount===0?0:(completedCourse*100)/enrolldCount
return {
    total:enrolldCount,completed:completedCourse,inProgress,persentage
}}


   public async getCommonCategory(studentId:number){
   const lastEnrollCourse=await this.enrollRepo.findOne({
    where:{user:{id:studentId}},order:{enrolledAt:'DESC',id:'DESC'},relations:{course:{category:true}}
   })
   const cat=lastEnrollCourse?.course?.category?.id;
    // no enrollment (or a course without category): nothing to base a suggestion on
    if(cat==null) return [];
    return this.courseService.getSuggestedCourses(cat);
   }





}
