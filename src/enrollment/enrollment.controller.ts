import { BadRequestException, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { EnrollmentService } from './enrollment.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { Roleguard } from 'src/common/Guards/role.guard';
import { EnrollmentStatus } from 'src/utils/enums/enroll.enum';

@Controller('api/enrollment/')
export class EnrollmentController {
    constructor(private enrollService: EnrollmentService) { }

    @Get('my_enrollments')
    @Roles(UserRoles.STUDENT)
    @UseGuards(AuthGuard, Roleguard)
    getEnrolledCourses(@Payload() payload: paylodType.PayloadType,@Query('status') status:EnrollmentStatus) {
        if(status!==undefined&&!Object.values(EnrollmentStatus).includes(status)) throw new BadRequestException('Invalid status');
        return this.enrollService.getStudentCourses(payload.id,status);
    }


    @Get('suggestedCourses')
    @Roles(UserRoles.STUDENT)
    @UseGuards(AuthGuard, Roleguard)
    getSuggestd(@Payload() payload: paylodType.PayloadType) {
    return this.enrollService.getCommonCategory(payload.id);
    }

    @Get('students/:courseId')
    @Roles(UserRoles.INSTRACTOR, UserRoles.ADMIN)
    @UseGuards(AuthGuard, Roleguard)
    getStudentsEnroll(@Param('courseId', new ParseIntPipe) courseId: number, @Payload() payload: paylodType.PayloadType) {
        return this.enrollService.getCourseStudentsFor(courseId, payload.id, payload.role);
    }


    @Get('isStudentEnroll/:courseId')
    @UseGuards(AuthGuard)
    isStudentEnrolls(@Param('courseId', new ParseIntPipe) courseId: number, @Payload() payload: paylodType.PayloadType) {
        return this.enrollService.verifyStudentEnrollment(payload.id, courseId);
    }


    @Get('course/studentsCount/:courseId')
    @UseGuards(AuthGuard)
    getStudentsCount(@Param('courseId', new ParseIntPipe) courseId: number) {
        return this.enrollService.getCourseStdentsCount(courseId);
    }

    // count of studets belong  to instraactor
    @Get('instractor/studentsCount')
    @Roles(UserRoles.ADMIN, UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    getInstractorStudents(@Payload() payload: paylodType.PayloadType) {
        return this.enrollService.getStudentsCountWithInstractor(payload.id);
    }




}
