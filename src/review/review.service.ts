import { BadGatewayException, BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ReviewEntity } from './review.enity';
import { Repository } from 'typeorm';
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
if(!courseId||!userId||!dto.comment||!dto.rateing) throw new BadGatewayException();
const verify=await this.verify(courseId,userId);
if(!verify) throw new UnauthorizedException('You Need TO Purshace This Course Frist');
const review=this.reviewRepo.create({
    ...dto,user:{id:userId},course:{id:courseId}
});
const resulte=await this.reviewRepo.save(review);
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
const review=await this.reviewRepo.findOne({where:{id:reviewId}});
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
if(!courseId||!payload.id||!reviewId) throw new BadGatewayException();
const review=await this.reviewRepo.findOne({where:{id:reviewId},relations:{user:true},select:{user:{id:true}}});
if(!review) throw new NotFoundException();

const course=await this.courseService.getSingleCourse(courseId);
if(payload.role!=UserRoles.ADMIN){
if((course.Instractor.id!=payload.id&&payload.role!=UserRoles.INSTRACTOR)){
const studentAllowed=await this.isStudentOwnsComment(payload.id,reviewId);
if(!studentAllowed) throw new UnauthorizedException();
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
const user=await this.userService.getInstractorInfo(userId);
if(!user||user.personalInfo.role==UserRoles.INSTRACTOR) throw new UnauthorizedException();
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

async isStudentOwnsComment(studentId:number,reviewId){
if(!studentId) throw new BadRequestException('User is not found');
const review=await this.reviewRepo.findOne({
    where:{id:reviewId,user:{id:studentId}}
});
return !! review;
}


}
