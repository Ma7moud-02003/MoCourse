import { MAX_THUMBNAIL_BYTES } from 'src/utils/upload-validation';
// multer rejects a file that reaches the limit, so the limit is cap + 1 byte to allow exactly the cap.
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { CouurseDto } from './dtos/course.dto';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { CourseService } from './course.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { CourseLevel } from 'src/utils/enums/level.enum';


@Controller('api/course/')
export class CourseController {
  constructor(
    private courseServise: CourseService
  ) {

  }
  @Roles(UserRoles.INSTRACTOR)
  @UseGuards(AuthGuard, Roleguard)
  @UseInterceptors(FileInterceptor('thumbnail', { limits: { fileSize: MAX_THUMBNAIL_BYTES } }))
  @Post('')
  add(@Body() body: CouurseDto, @Payload() payload: paylodType.PayloadType, @UploadedFile() file: any) {
    return this.courseServise.addNewCourse(body, file, payload.id)
  }

  @Get('all')
  @UseGuards(AuthGuard)
  getAll(
    @Query('title') title: string,
    @Query('level') level: CourseLevel,
    @Query('categoryId') categoryId: string,
    @Query('minPrice') minPrice: string,
    @Query('maxPrice') maxPrice: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('sort') sort: string,
    @Payload() payload: paylodType.PayloadType,
  ) {
    return this.courseServise.getAllCourses(title, parseInt(categoryId), parseInt(minPrice), parseInt(maxPrice), level, payload.role, page, limit, sort);
  }

  @Get('ins/myCourses')
  @Roles(UserRoles.INSTRACTOR, UserRoles.STUDENT)
  @UseGuards(AuthGuard, Roleguard)
  getForInstarctor(@Payload() payload: paylodType.PayloadType) {
    return this.courseServise.getInsCourses(payload);
  }

  


  // Update Course details by instractor
  @Roles(UserRoles.INSTRACTOR, UserRoles.ADMIN)
  @UseGuards(AuthGuard, Roleguard)
  @UseInterceptors(FileInterceptor('thumbnail', { limits: { fileSize: MAX_THUMBNAIL_BYTES } }))
  @Patch('update/:id')
  update(@Param('id', new ParseIntPipe) id: number, @Body() body: any,
    @Payload() payload: paylodType.PayloadType, @UploadedFile() file: any) {
    return this.courseServise.updateCourse(body, id, payload.id, payload.role, file)
  }



  @UseGuards(AuthGuard)
  @Get('details/:id')
  @UseGuards(AuthGuard)
  getCourseDetails(@Param('id', new ParseIntPipe()) id: number,@Payload() payload:paylodType.PayloadType) {
    return this.courseServise.getCourseDetails(id,payload.id,payload.role,true);
  }


  @Roles(UserRoles.INSTRACTOR, UserRoles.ADMIN)
  @UseGuards(AuthGuard, Roleguard)
  @Delete('delete/:id')
  delete(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType) {
    return this.courseServise.deleteCourse(id, payload.id, payload.role);
  }

  // get courses belong to instractor

  @Get('coursesCount')
  @Roles(UserRoles.ADMIN, UserRoles.INSTRACTOR)
  @UseGuards(AuthGuard, Roleguard)
  getCoursesCount(@Payload() payload: paylodType.PayloadType) {
    return this.courseServise.getCoursesCountBelongsToInstractor(payload.id);
  }


}
