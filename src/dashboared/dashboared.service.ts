import { Injectable } from '@nestjs/common';
import { CourseService } from 'src/course/course.service';
import { EnrollmentService } from 'src/enrollment/enrollment.service';
import { ProgressService } from 'src/progress/progress.service';
import { PurchaseService } from 'src/Purchase/purchase.service';

@Injectable()
export class DashboaredService {
    constructor(
        private courseService:CourseService,
        private enrollmentService:EnrollmentService,
        private purchaseService:PurchaseService,
        private progressService:ProgressService

    ){

    }

/**
 *  Instractor Dashboared Counts
 * @param insId 
 */
public async getInstractorDashboared(insId:number){
const coursesCount=await this.courseService.getCoursesCountBelongsToInstractor(insId); 
const enrolledStudents=await this.enrollmentService.getStudentsCountWithInstractor(insId);
const purshace=await this.purchaseService.getPurchaseNum(insId);
const totalProfite=await this.purchaseService.getTotalProfite(insId);
const studentsCourseCompletionRate=await this.enrollmentService.getStudentsCourseCompletionRate(insId);
return {
    coursesCount,enrolledStudents,...purshace,totalProfite,...studentsCourseCompletionRate
}
}

public async getInstractorLastThings(insId:number){
const lastPurchase=await this.purchaseService.getLastPendingPurchase(insId);
const mostCoursePurshaced=await this.purchaseService.getMostCoursePurchased(insId);
const mostCompletedLesson=await this.progressService.getMostCompletedLesson(insId);
return{
lastPurchase,mostCompletedLesson,mostCoursePurshaced
}
}


public async getStudentDashboared(studentId:number){
const coursesNumDetails=await this.enrollmentService.getStudentCoursesCount(studentId);
const lastCourses=await this.enrollmentService.getLastCoursesOfStudent(studentId);
const lastLesson=await this.progressService.getLastLessonForStudnt(studentId);
return{
coursesNumDetails,lastCourses,lastLesson
}
}



}


