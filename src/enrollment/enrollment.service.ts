import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EnrollmentEntity } from './enrollment.entity';
import { EntityManager, Repository } from 'typeorm';
import { CourseEntity } from 'src/course/course.entity';
import { CourseService } from 'src/course/course.service';
import { EnrollmentStatus } from 'src/utils/enums/enroll.enum';
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
if(!courseId&&!studentId) throw new BadRequestException();
const exist=await this.enrollRepo.findOne({where:{
    course:{id:courseId},
    user:{id:studentId}
}})
if(exist) throw new BadRequestException('You are alrealdy enroll this course');
console.log(courseId);

const course=await this.courseService.getSingleCourse(courseId); // proplem is here 
if(!course) throw new NotFoundException('Course is not existed')
if(!course.isPublished) throw new BadRequestException('Course is not Published Yet');
 const enroll=this.enrollRepo.create({
    course:{id:courseId},
    user:{id:studentId}
 })
 await this.enrollRepo.save(enroll);
          //creating notification for instractor
 await this.notifiService.creatNotification(
               courseId,studentId,
               `اشتراك ناجح `,
              ` تم اشتركك بنجاح في كورس ${course.title}`,
               NotificationType.ENROLLMENT  
               )
                       
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
await repo.save(repo.create({course:{id:courseId},user:{id:studentId}}));
return true;
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
if(courses.length==0) return new NotFoundException('No Courses Provided For You');
return courses;
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
  if (enroll.status === EnrollmentStatus.COMPLETED)
 return ;
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
if(total==0) return {percentage:0};
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
    ,order:{enrolledAt:'ASC'},take:2
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

const persentage=(completedCourse*100)/enrolldCount
return {
    total:enrolldCount,completed:completedCourse,inProgress,persentage
}}


   public async getCommonCategory(studentId:number){
   const lastEnrollCourse=await this.enrollRepo.findOne({
    where:{user:{id:studentId}},order:{enrolledAt:'ASC'},relations:{course:{category:true}}
   })
   const cat=lastEnrollCourse?.course.category.id;
    return this.courseService.getSuggestedCourses(cat);
   }





}
