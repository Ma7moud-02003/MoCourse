import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReviewEntity } from './review.enity';
import { QueryFailedError, Repository } from 'typeorm';
import { CreatCommentDto } from './dtos/cret-comment.dto';
import { CourseService } from 'src/course/course.service';
import { UserService } from 'src/User/user/user.service';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { EnrollmentService } from 'src/enrollment/enrollment.service';
import { UpdateCommentDto } from './dtos/updateRevier.dto';
import { PayloadType } from 'src/utils/types/paylod.type';

@Injectable()
export class ReviewService {
constructor(
    @InjectRepository(ReviewEntity)
private reviewRepo:Repository<ReviewEntity>,
private courseService:CourseService,
private userService:UserService,
private enrollmentService:EnrollmentService

){

}

/**
 * addding new comment by enrolled student
 * @param courseId 
 * @param userId 
 * @param dto 
 * @returns  added successfully
 */
public async addNewComment(courseId:number,userId:number,dto:CreatCommentDto){
if(!courseId||!userId||!dto.comment||dto.rateing===undefined||dto.rateing===null) throw new BadRequestException('Required values are missing');
const verify=await this.verify(courseId,userId);
if(!verify) throw new UnauthorizedException('You Need TO Purshace This Course Frist');
// one review per student per course: a changed opinion edits the existing review (owner-approved rule)
const existing=await this.reviewRepo.findOne({where:{user:{id:userId},course:{id:courseId}}});
if(existing) throw new ConflictException('You already reviewed this course. Update your existing review instead.');
// pick the allowed fields explicitly: the global ValidationPipe runs without whitelist, so
// spreading the body would let an injected id turn this insert into an update of someone else's review
const review=this.reviewRepo.create({
    comment:dto.comment,rateing:dto.rateing,user:{id:userId},course:{id:courseId}
});
let resulte:ReviewEntity;
try{
resulte=await this.reviewRepo.save(review);
}catch(err){
// a concurrent submission of the same student/course pair hits the unique rule: same answer as the check above
if(err instanceof QueryFailedError&&(err.driverError as {code?:string})?.code=='23505'){
throw new ConflictException('You already reviewed this course. Update your existing review instead.');
}
throw err;
}
return {
id:resulte.id,
comment:resulte.comment,
rateing:resulte.rateing,
createdAt:resulte.createdAt,
}
}
/**
 * update comment by own student 
 * @param reviewId 
 * @param courseId 
 * @param userId 
 * @param dto 
 * @returns  updated successfully message 
 */
public async updateComment(reviewId:number,courseId:number,userId:number,dto:UpdateCommentDto){
if(!courseId||!userId||!reviewId) throw new BadRequestException();
const verify=await this.verify(courseId,userId);
if(!verify) throw new UnauthorizedException('You Need TO Purshace This Course Frist');
const review=await this.reviewRepo.findOne({where:{id:reviewId,course:{id:courseId}}});
if(!review) throw new NotFoundException();
const allowedStudent=await this.isStudentOwnsComment(userId,reviewId);
if(!allowedStudent) throw new UnauthorizedException();

review.comment=dto.comment??review.comment;
review.rateing=dto.rateing??review.rateing;
await this.reviewRepo.save(review);
return {
message:'Updated Successfully'
}
}

/**
 * delete comment by own indtractor or own student or admin
 * @param reviewId 
 * @param courseId 
 * @param payload 
 * @returns removed successfully message 
 */
public async deleteReview(reviewId:number,courseId:number,payload:PayloadType){
if(!courseId||!payload.id||!reviewId) throw new BadRequestException('Required values are missing');
const review=await this.reviewRepo.findOne({where:{id:reviewId,course:{id:courseId}},relations:{user:true},select:{user:{id:true}}});
if(!review) throw new NotFoundException();

if(payload.role!=UserRoles.ADMIN){
const course=await this.courseService.getSingleCourse(courseId);
const isCourseInstractor=payload.role==UserRoles.INSTRACTOR&&course.Instractor.id==payload.id;
if(!isCourseInstractor){
const isOwnStudentReview=payload.role==UserRoles.STUDENT&&review.user.id==payload.id;
if(!isOwnStudentReview) throw new UnauthorizedException();
}}
await this.reviewRepo.remove(review);
 return {
    message:'Removed Successfully'
 }}

 public async getMyReviews(userId:number){
    if(!userId) throw new NotFoundException();
    const reviews=await this.reviewRepo.find({
        where:{
            user:{id:userId}
        },relations:{user:true}
    });
    return reviews;
 }

 /**
  *  getting all reviews for course
  * @param courseId 
  * @returns reviews with thier owns 
  */
 public async getCourseReviews(courseId:number){
if(!courseId) throw new NotFoundException();
    const reviews=await this.reviewRepo.find({
        where:{
            course:{id:courseId}
        },relations:{user:true},select:{
            user:{id:true,avatar:true,fullName:true}
        },order:{createdAt:'DESC'}
    });
    return  reviews;
 }


async verify(courseId:number,userId:number){
const course=await this.courseService.getSingleCourse(courseId);
if(!course) throw new BadRequestException('Course is not found');
const role=await this.userService.getUserRole(userId);
if(role==UserRoles.INSTRACTOR) throw new UnauthorizedException();
const verifyed=await this.enrollmentService.verifyStudentEnrollment(userId,courseId);
return  !!verifyed;
}
 
public async isStudentHasCommentInThisCourse(userId:number,courseId:number){
const has=await this.reviewRepo.findOne({
    where:{
        user:{id:userId},
        course:{id:courseId}
    }
})
return !! has;
}

async isStudentOwnsComment(studentId:number,reviewId:number){
if(!studentId) throw new BadRequestException('User is not found');
const review=await this.reviewRepo.findOne({
    where:{id:reviewId,user:{id:studentId}}
});
return !! review;
}


}
