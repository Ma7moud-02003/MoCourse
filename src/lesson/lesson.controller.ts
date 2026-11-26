import { BoundedTempUploadInterceptor, lessonUploadLimits, tempDiskStorage } from 'src/common/upload/temp-upload';
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { CreateLessonDto } from './dtos/lessin.dto';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { UpdateLessonDto } from './dtos/updateLesson.dto';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('api/lesson/')
export class LessonController {
    constructor(
        private lessonServise: LessonService
    ) { }

    @Post('')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    addLesson(@Body() body: CreateLessonDto, @Payload() payload: paylodType.PayloadType) {
        return this.lessonServise.addLesson(body, payload.id);
    }

    @Patch('update/:id')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    updateLesson(@Param('id', new ParseIntPipe) id: number, @Body() body: UpdateLessonDto, @Payload() payload: paylodType.PayloadType) {
        return this.lessonServise.updateLessone(id, body, payload.id);
    }


    @Get('lessons/:id')
    @UseGuards(AuthGuard)
    getLessons(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType) {
        return this.lessonServise.getSectiionLessons(id, payload.id, payload.role);
    }

    @Get('details/:id')
    @UseGuards(AuthGuard)
    getSingleLesson(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType) {
        return this.lessonServise.getLesson(id, payload.id, payload.role);
    }


    @Patch('uploadFile/:id')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    @UseInterceptors(BoundedTempUploadInterceptor, FileInterceptor('file', { storage: tempDiskStorage, limits: lessonUploadLimits }))
    upload(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType, @UploadedFile() file: Express.Multer.File) {
        return this.lessonServise.updateLesson_Upload(file, id, payload.id)
    }

    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    @Delete('delete/:id')
    deleteLesson(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType) {
        return this.lessonServise.deleteLesson(id, payload.id);
    }



}
