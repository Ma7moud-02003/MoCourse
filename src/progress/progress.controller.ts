import { Body, Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { UpdateProgressDto } from './creatProg.dto.ts/updateProg.dto';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { Roleguard } from 'src/common/Guards/role.guard';

@Controller('api/progress/')
export class ProgressController {
    constructor(private progService: ProgressService) {
    }

    @Get('lessson_progress/:id')
    @UseGuards(AuthGuard)
    getProgress(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType) {
        return this.progService.getSingleProgress(id, payload.id);
    }



    @Get('course_progress/:id')
    @UseGuards(AuthGuard)
    getCourseProgress(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType) {
        return this.progService.getCourseProgress(id, payload.id);
    }





    @Get('instractor/course_progress/:courseId/:studentId')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    getStudentProgressForInstractor(@Param('courseId', new ParseIntPipe) courseId: number, @Param('studentId', new ParseIntPipe) studentId: number) {
        console.log(courseId, studentId);
        return this.progService.getCourseProgress(courseId, studentId);
    }

    @Patch('update_lesson')
    @UseGuards(AuthGuard)
    updateProgress(@Body() body: UpdateProgressDto, @Payload() payload: paylodType.PayloadType) {
        return this.progService.updateProgress(body, payload.id);
    }


}
