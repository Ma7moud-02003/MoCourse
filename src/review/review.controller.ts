import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreatCommentDto } from './dtos/cret-comment.dto';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { ReviewService } from './review.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { OptionalAuthGuard } from 'src/common/Guards/optional-auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { UpdateCommentDto } from './dtos/updateRevier.dto';

@Controller('api/review/')
export class ReviewController {
    constructor(
        private reviewCourse:ReviewService
    ){}

    // public for published courses (no login needed, no private account data).
    // A draft course's reviews are readable only by its own instructor, an admin or an enrolled student; everyone else gets 404.
    @Get('course/:courseId')
    @UseGuards(OptionalAuthGuard)
    getCourseReviews(@Param('courseId',new ParseIntPipe()) courseId:number,
    @Query('page') page?:string,@Query('limit') limit?:string,@Req() req?:any){
    return this.reviewCourse.getCourseReviews(courseId,Number(page)||1,Number(limit)||20,req?.user);
    }

    @Post('add/:courseId')
    @Roles(UserRoles.ADMIN,UserRoles.STUDENT)
    @UseGuards(AuthGuard,Roleguard)
    add(@Body() body:CreatCommentDto,@Param('courseId',new ParseIntPipe) courseId:number,@Payload() payload:paylodType.PayloadType){
    return this.reviewCourse.addNewComment(courseId,payload.id,body);
    }

    @Patch('update/:courseId/:reviewId')
    @Roles(UserRoles.ADMIN,UserRoles.STUDENT)
    @UseGuards(AuthGuard,Roleguard)
    update(@Body() body:UpdateCommentDto,@Param('courseId',new ParseIntPipe) courseId:number,
    @Param('reviewId',new ParseIntPipe) reviewId:number
    ,@Payload() payload:paylodType.PayloadType){
    return this.reviewCourse.updateComment(reviewId,courseId,payload.id,body);
    }

    @Get('myReviews')
    @Roles(UserRoles.ADMIN,UserRoles.STUDENT)
    @UseGuards(AuthGuard,Roleguard)
    getMy(@Payload() payload:paylodType.PayloadType){
    return this.reviewCourse.getMyReviews(payload.id)
    }


    @Delete('delete/:courseId/:revId')
    @Roles(UserRoles.ADMIN,UserRoles.STUDENT,UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard,Roleguard)
    delete(@Payload() payload:paylodType.PayloadType,@Param('courseId',new ParseIntPipe()) courseId:number
    ,@Param('revId',new ParseIntPipe()) revId:number, ){
    return this.reviewCourse.deleteReview(revId,courseId,payload);
    }

    @Get('isStudentHasComment/:courseId')
    @Roles(UserRoles.STUDENT)
    @UseGuards(AuthGuard,Roleguard)
    isStudentHasCommebt(@Payload() payload:paylodType.PayloadType,@Param('courseId',new ParseIntPipe()) courseId:number){
    return this.reviewCourse.isStudentHasCommentInThisCourse(payload.id,courseId)
    }


}
