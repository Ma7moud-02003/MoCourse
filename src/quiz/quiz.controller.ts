import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { QuizService } from './quiz.service';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { CreateQuizDto } from './dtos/creat.dto';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { UpdateQuizDto } from './dtos/update.dto';

@Controller('api/quiz/')
export class QuizController {
constructor(private quizService:QuizService){}

@Roles(UserRoles.INSTRACTOR,UserRoles.ADMIN)
@UseGuards(AuthGuard,Roleguard)
@Post('')
creat(@Payload() payload:paylodType.PayloadType,@Body() body:CreateQuizDto){
return this.quizService.creatNewQuiz(payload.id,body)
}

@Roles(UserRoles.INSTRACTOR,UserRoles.ADMIN)
@UseGuards(AuthGuard,Roleguard)
@Patch('/:id')
edite(@Param('id',new ParseIntPipe()) quizeId:number,@Payload() payload:paylodType.PayloadType,@Body() body:UpdateQuizDto){
console.log(quizeId,payload,body);    
return this.quizService.updateQuiz(quizeId,payload.id,body)
}

@Roles(UserRoles.INSTRACTOR,UserRoles.ADMIN)
@UseGuards(AuthGuard,Roleguard)
@Get('insQuizes')
getQuizesAsInstractor(@Payload() payload:paylodType.PayloadType){
return this.quizService.getInsQuizes(payload.id)
}

@Roles(UserRoles.INSTRACTOR,UserRoles.ADMIN)
@UseGuards(AuthGuard,Roleguard)
@Get('quiz-details/:id')
getQuizDetails(@Query('pageNum') pageNum:number,@Param('id') quizId:number,@Payload() payload:paylodType.PayloadType){
return this.quizService.getQuizDetails(quizId,payload.id,pageNum||1)
}

@UseGuards(AuthGuard)
@Get('courseQuiz/:id')
getCourseQuizes(@Param('id',new ParseIntPipe()) id:number,@Payload() payload:paylodType.PayloadType){
return this.quizService.getQuizes(payload.id,id)
}

@UseGuards(AuthGuard)
@Delete('/:id')
deleteQuiz(@Param('id',new ParseIntPipe()) quizId:number,@Payload() payload:paylodType.PayloadType){
return this.quizService.deleteQuize(quizId,payload.id)
}

}