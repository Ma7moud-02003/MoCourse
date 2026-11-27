import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterDto } from './Dtos/register.dto';
import { LoginDto } from './Dtos/login.dto';
import { AuthGuard } from '../../common/Guards/auth.guard';
import { Payload } from '../../common/Decorators/payload.decorator';
import { Roles } from '../../common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { Roleguard } from '../../common/Guards/role.guard';
import { UpdateUserDto } from './Dtos/update.dto';
import { DeleteAccountDto } from './Dtos/delete-account.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_AVATAR_BYTES } from 'src/utils/upload-validation';
import * as paylodType from 'src/utils/types/paylod.type';

@Controller('api/user/')
export class UserController {
    constructor(private userService:UserService){
    }

    // Register new user
    @Post('auth/register')
    register(@Body() body:RegisterDto){
   return  this.userService.register(body);
    }

    // Login 

    @Post('auth/login')
    @HttpCode(HttpStatus.OK)
    login(@Body() body:LoginDto){
     return this.userService.login(body);
    }

    @Get('currentUser')
    @UseGuards(AuthGuard)
    getUser(@Payload() payload){
    const id=payload.id;
    return this.userService.getInstractorInfo(id);
    }
    
  
    @Roles(UserRoles.ADMIN)
    @UseGuards(AuthGuard,Roleguard)
    @Get('all_users')
    getAll(@Query('page') page?: string, @Query('limit') limit?: string){
        return this.userService.getAllUsers(page, limit);
    }

    // Update User By Himself
    @Patch('update')
    @UseGuards(AuthGuard)
    updeteUserByUser(@Payload() payload:paylodType.PayloadType,@Body() body:UpdateUserDto){
     return this.userService.updateUser(payload.id,body,true)
    }

      // Update User By Admin
    @Patch('updateByAdmin/:id')
    @Roles(UserRoles.ADMIN)
    @UseGuards(AuthGuard,Roleguard)
    updeteUserByAdmin(@Param('id',new ParseIntPipe) id,@Body() body:UpdateUserDto){
    return this.userService.updateUser(id,body)
    }

    // Delete User By User 
      @Delete('delete')
    @UseGuards(AuthGuard)
    deleteUserByUser(@Payload() payload:paylodType.PayloadType,@Body() body:DeleteAccountDto){
     return this.userService.deleteOwnAccount(payload.id,body.password)
    }

    // Change own profile photo (multipart field "avatar", image up to 2 MB)
    @Patch('avatar')
    @UseGuards(AuthGuard)
    @UseInterceptors(FileInterceptor('avatar',{limits:{fileSize:MAX_AVATAR_BYTES}}))
    updateAvatar(@Payload() payload:paylodType.PayloadType,@UploadedFile() file:Express.Multer.File){
     return this.userService.updateAvatar(payload.id,file)
    }


    
    // Delete User By Admin 
      @Delete('deleteByAdmin/:id')
      @Roles(UserRoles.ADMIN)
    @UseGuards(AuthGuard,Roleguard)
    deleteUserByAdmin(@Param('id',new ParseIntPipe) id ){
     return this.userService.deleteUser(id);
    }

    @Get('role')
    @UseGuards(AuthGuard)
    getRole(@Payload() payload:paylodType.PayloadType){
      return payload.role;
    }
    


}
