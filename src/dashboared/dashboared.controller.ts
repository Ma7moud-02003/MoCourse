import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboaredService } from './dashboared.service';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';

@Controller('api/dashboared/')
export class DashboaredController {
    constructor(
        private dashboaredService: DashboaredService
    ) { }
    @Get('instractor/numbers')
    @Roles(UserRoles.INSTRACTOR, UserRoles.ADMIN)
    @UseGuards(AuthGuard, Roleguard)
    getInstractorDasboared(@Payload() payload: paylodType.PayloadType) {
        return this.dashboaredService.getInstractorDashboared(payload.id);
    }

    @Get('instractor/lastInfo')
    @Roles(UserRoles.INSTRACTOR, UserRoles.ADMIN)
    @UseGuards(AuthGuard, Roleguard)
    getLastInfo(@Payload() payload: paylodType.PayloadType) {
        return this.dashboaredService.getInstractorLastThings(payload.id);
    }

    
    @Get('student/info')
    @Roles(UserRoles.STUDENT)
    @UseGuards(AuthGuard, Roleguard)
    getStudentDashboared(@Payload() payload: paylodType.PayloadType) {
    return this.dashboaredService.getStudentDashboared(payload.id);
    }
}
