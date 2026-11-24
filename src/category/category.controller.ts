import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryDto } from './dtos/cat.dto';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';

@Controller('api/category/')
export class CategoryController {
    constructor(private catService: CategoryService) { }

    @Post('')
    @Roles(UserRoles.ADMIN)
    @UseGuards(AuthGuard, Roleguard)
    addCatog(@Body() cat: CategoryDto) {
        return this.catService.creatCat(cat);
    }

    @Get('all')
    @Roles(UserRoles.ADMIN, UserRoles.INSTRACTOR)
    @UseGuards(AuthGuard, Roleguard)
    getAll() {
        return this.catService.getAllCatogs();
    }
}
