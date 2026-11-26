import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { PaymentInfoDto } from './dtos/paymentInfo.dto';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { PaymentinfoService } from './paymentinfo.service';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';

@Controller('api/paymentinfo/')
export class PaymentinfoController {
constructor(private paymentService:PaymentinfoService){

}
@Post('')
@Roles(UserRoles.INSTRACTOR)
@UseGuards(AuthGuard,Roleguard)
addPaymentInfo(@Body() body:PaymentInfoDto,@Payload() payload:paylodType.PayloadType){
return this.paymentService.addPaymentInfo(body,payload.id);
}

@Patch('update')
@Roles(UserRoles.INSTRACTOR)
@UseGuards(AuthGuard,Roleguard)
updatepaymentInfo(@Body() body:PaymentInfoDto,@Payload() payload:paylodType.PayloadType){
return this.paymentService.updatedPaymentInfo(body,payload.id);
}

// Full payment info of one instructor: only that instructor and an admin may read it.
@Get('info/:id')
@UseGuards(AuthGuard)
getPaymentInfo(@Param('id',new ParseIntPipe) id:number,@Payload() payload:paylodType.PayloadType){
return this.paymentService.getInsPatmentInfoForViewer(id,payload);
}

// A student about to pay: only the payment details of the instructor who owns this published course.
@Get('course/:courseId')
@Roles(UserRoles.STUDENT)
@UseGuards(AuthGuard,Roleguard)
getPaymentInfoForCourse(@Param('courseId',new ParseIntPipe) courseId:number){
return this.paymentService.getPaymentInfoForCourse(courseId);
}

@Get('my')
@Roles(UserRoles.INSTRACTOR)
@UseGuards(AuthGuard,Roleguard)
getMyPaymentInfo(@Payload() payload:paylodType.PayloadType){
return this.paymentService.getInsPatmentInfo(payload.id);
}

@Get('all')
@Roles(UserRoles.ADMIN)
@UseGuards(AuthGuard,Roleguard)
getAl(){
return this.paymentService.getAllPaymentInfo();
}


}
