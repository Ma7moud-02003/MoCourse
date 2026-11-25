import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SectionDto } from './dtos/section.dto';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { SectionService } from './section.service';

@Controller('api/section/')
export class SectionController {
    constructor(
        private sectionService:SectionService
    ){

    }

    @Post('')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard,Roleguard)
    add(@Body() body:SectionDto,@Payload() payload:paylodType.PayloadType){
     return  this.sectionService.addSection(body,payload.id);
    }
    
     @Get('sections/:id')
    @UseGuards(AuthGuard)
    getAll(@Param('id',new ParseIntPipe) id:number,
    @Query('pageNumber') pageNumber:number,@Payload() payload:paylodType.PayloadType){
     return  this.sectionService.getCourseSections(id,payload.id,pageNumber,payload.role);
    }

    @Patch('update/:id')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard,Roleguard)
    update(@Param('id',new ParseIntPipe) id:number,@Body() body:SectionDto,@Payload() payload:paylodType.PayloadType){
    return  this.sectionService.updateSection(body,id,payload.id);
    }

     @Delete('delete/:id')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard,Roleguard)
    delete(@Param('id',new ParseIntPipe) id:number,@Payload() payload:paylodType.PayloadType){
    return  this.sectionService.deleteSection(id,payload.id);
    }

}
