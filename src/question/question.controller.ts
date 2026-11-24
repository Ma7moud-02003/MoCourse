import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CreateQuestionsDto } from './dtos/question.dto';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { QuestionService } from './question.service';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';
import { UpdateQuestionDto } from './dtos/updateQuestion.dto';

@Controller('api/question/')
export class QuestionController {
constructor(
    private question:QuestionService
){}
 @Post('')
 @Roles(UserRoles.ADMIN,UserRoles.INSTRACTOR)
 @UseGuards(AuthGuard,Roleguard)
 add(@Body() body:CreateQuestionsDto,@Payload() payload:paylodType.PayloadType){
return this.question.addQuestins(payload.id,body);
 }   


 @Patch(':id')
  @Roles(UserRoles.ADMIN, UserRoles.INSTRACTOR)
  @UseGuards(AuthGuard, Roleguard)
  async update(
    @Param('id', ParseIntPipe) questionId: number,
    @Body() body: UpdateQuestionDto,
    @Payload() payload:paylodType.PayloadType,
  ) {
    return this.question.updateQuestion(payload.id, questionId, body);
  }
 
 @Get('quiz-questions')
 @Roles(UserRoles.ADMIN,UserRoles.INSTRACTOR)
 @UseGuards(AuthGuard,Roleguard)
 get(@Param('quizId',new ParseIntPipe()) quizId:number,@Payload() payload:paylodType.PayloadType){
return this.question.getQuizQuestions(quizId,payload.id);
 }   
  @Delete('/:id')
 @Roles(UserRoles.ADMIN,UserRoles.INSTRACTOR)
 @UseGuards(AuthGuard,Roleguard)
 delete(@Param('id') questionId:number , @Payload() payload:paylodType.PayloadType){
return this.question.deleteQuestions(questionId,payload.id)
 }   
}
