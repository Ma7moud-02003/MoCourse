import {
    Body, Controller, Get, Param,
    ParseIntPipe, Patch, Post, Query, UploadedFile,
    UseGuards, UseInterceptors
} from '@nestjs/common';

import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { PurchaseService } from './purchase.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { ConfirmCheckoutDto } from './dtos/confirm.dto';
import { StatusEnum } from 'src/utils/enums/purchaseStatus.enum';
import { UpdatePurchaseStatusDto } from './dtos/status.dto';
import { FileInterceptor } from '@nestjs/platform-express';


@Controller('api/buy/')
export class PurchaseController {
    constructor(
        private purServise: PurchaseService
    ) { }

    @Post(':id')
    @Roles(UserRoles.STUDENT)
    @UseGuards(AuthGuard, Roleguard)
    buy(@Param('id', new ParseIntPipe) id: number, @Payload() payload: paylodType.PayloadType) {
        return this.purServise.buyCourse(payload.id, id)
    }

    @Patch('confirm/:id')
    @Roles(UserRoles.STUDENT)
    @UseGuards(AuthGuard, Roleguard)
    @UseInterceptors(FileInterceptor('thumbnail'))
    confirmCheckout(@Param('id', new ParseIntPipe()) id: number
        , @Body() body: ConfirmCheckoutDto, @UploadedFile() file: any
        , @Payload() payload: paylodType.PayloadType) {
        console.log(id, payload, body);
        return this.purServise.confirmCheckOut(id, body, payload.id, file);
    }


    @Get('myPurchases')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    getInsPurchase(@Payload() payload: paylodType.PayloadType,
        @Query('status') status: StatusEnum) {
        return this.purServise.getInsPurchase(payload.id, status);
    }

    @Patch('update/:id')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    updateStatusByIns(@Payload() payload: paylodType.PayloadType, @Body() body: UpdatePurchaseStatusDto, @Param('id', ParseIntPipe) id: number) {
        return this.purServise.updatPurchaseStatus(id, body.status, payload.id);
    }


    // get count of purchase belong to instractor
    @Get('myPurchasesCount')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    getMyPurshaseNum(@Payload() payload: paylodType.PayloadType) {
        return this.purServise.getPurchaseNum(payload.id);
    }

    // get count of purchase belong to instractor
    @Get('totalProfite')
    @Roles(UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    getTotalMony(@Payload() payload: paylodType.PayloadType,
    ) {
        return this.purServise.getTotalProfite(payload.id);
    }



}
