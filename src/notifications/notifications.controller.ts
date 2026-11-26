import { Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as payloadType from 'src/utils/types/paylod.type';

// every route is for the logged-in user's OWN notifications only (the id always comes from the token)
@Controller('api/notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
    constructor(private notifiService: NotificationsService) {}

    @Get()
    list(@Payload() payload: payloadType.PayloadType, @Query('page') page?: string, @Query('limit') limit?: string) {
        return this.notifiService.getMyNotitfications(payload.id, Number(page) || 1, Number(limit) || 20);
    }

    @Get('unread-count')
    unreadCount(@Payload() payload: payloadType.PayloadType) {
        return this.notifiService.getUnreadCount(payload.id);
    }

    @Patch('read-all')
    readAll(@Payload() payload: payloadType.PayloadType) {
        return this.notifiService.markAllAsRead(payload.id);
    }

    @Patch(':id/read')
    readOne(@Param('id', new ParseIntPipe()) id: number, @Payload() payload: payloadType.PayloadType) {
        return this.notifiService.markAsRead(id, payload.id);
    }
}
