import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { CouurseDto } from './dtos/course.dto';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { CourseService } from './course.service';
import {  FileInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { UpdateCouurseDto } from './dtos/updateCourse.dto';


@Controller('api/course/')
export class CourseController {
constructor(
    private courseServise:CourseService
){

}
   @Roles(UserRoles.INSTRACTOR)
   @UseGuards(AuthGuard,Roleguard)
 @UseInterceptors(FileInterceptor('thumbnail'))
   @Post()
  add( @Body() body:CouurseDto,@Payload() payload:paylodType.PayloadType,@UploadedFile() file:any){
  console.log(body);
  return this.courseServise.addNewCourse(body,file,payload.id)
    }

    @Get('')
    @UseGuards(AuthGuard)
    getAll(){
    return this.courseServise.getAllCourses();
    }

     @Get('myCourses')
     @Roles(UserRoles.INSTRACTOR,UserRoles.STUDENT)
    @UseGuards(AuthGuard,Roleguard)
    getForInstarctor(@Payload() payload:paylodType.PayloadType){
      console.log(payload.id);
    return this.courseServise.getInsCourses(payload);
    }

   
    // Update Course details by instractor
     @Roles(UserRoles.INSTRACTOR,UserRoles.ADMIN)
   @UseGuards(AuthGuard,Roleguard)
 @UseInterceptors(FileInterceptor('thumbnail'))
   @Patch('update/:id')
  update(@Param('id',new ParseIntPipe) id:number, @Body() body:UpdateCouurseDto,
  @Payload() payload:paylodType.PayloadType,@UploadedFile() file:any){
  return this.courseServise.updateCourse(body,id,payload.id,payload.role,file)
    }


   
       @UseGuards(AuthGuard)
         @Delete('details/:id')
            getCourseDetails(@Param('id',new ParseIntPipe) id:number){
               return this.courseServise.getSingleCourse(id);
                    }


     @Roles(UserRoles.INSTRACTOR,UserRoles.ADMIN)
       @UseGuards(AuthGuard,Roleguard)
         @Delete('delete/:id')
            delete(@Param('id',new ParseIntPipe) id:number,@Payload() payload:paylodType.PayloadType){
               return this.courseServise.deleteCourse(id,payload.id,payload.role);
                    }


}
