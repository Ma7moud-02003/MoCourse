import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { EnrollmentService } from './enrollment.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { Roleguard } from 'src/common/Guards/role.guard';

@Controller('api/enrollment/')
export class EnrollmentController {
constructor(private enrollService:EnrollmentService){}

@Post(':id')
@Roles(UserRoles.STUDENT)
@UseGuards(AuthGuard,Roleguard)
enrollCourse(@Param('id',new ParseIntPipe) id,@Payload() payload:paylodType.PayloadType){
return this.enrollService.enrollCourse(id,payload.id);
}

@Get('my_enrollments')
@Roles(UserRoles.STUDENT)
@UseGuards(AuthGuard,Roleguard)
getEnrolledCourses(@Payload() payload:paylodType.PayloadType){
    console.log(payload);
    
return this.enrollService.getStudentCourses(payload.id);
}
}
