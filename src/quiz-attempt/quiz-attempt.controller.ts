import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query, Post, Put, UseGuards } from '@nestjs/common';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { QuizAttemptService } from './quiz-attempt.service';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { Roles } from 'src/common/Decorators/role.decorator';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import { Roleguard } from 'src/common/Guards/role.guard';

@Controller('api/quiz-attempt/')
export class QuizAttemptController {
  constructor(private attemptService: QuizAttemptService) {}

  @Roles(UserRoles.STUDENT)
  @UseGuards(AuthGuard, Roleguard)
  @Post('start/:quizId')
  start(@Param('quizId', new ParseIntPipe()) quizId: number, @Payload() payload: paylodType.PayloadType) {
    return this.attemptService.startAttempt(quizId, payload.id);
  }

  @Roles(UserRoles.STUDENT)
  @UseGuards(AuthGuard, Roleguard)
  @Post(':attemptId/submit')
  submit(@Param('attemptId', new ParseIntPipe()) attemptId: number, @Payload() payload: paylodType.PayloadType) {
    return this.attemptService.submitAttempt(attemptId, payload.id);
  }

  @Roles(UserRoles.STUDENT)
  @UseGuards(AuthGuard, Roleguard)
  @Put(':attemptId/answer')
  saveAnswer(
    @Param('attemptId', new ParseIntPipe()) attemptId: number,
    @Body() dto: SaveAnswerDto,
    @Payload() payload: paylodType.PayloadType,
  ) {
    return this.attemptService.saveAnswer(attemptId, payload.id, dto.questionId, dto.choiceId);
  }

  @Roles(UserRoles.STUDENT)
  @UseGuards(AuthGuard, Roleguard)
  @Get(':attemptId/result')
  result(@Param('attemptId', new ParseIntPipe()) attemptId: number, @Payload() payload: paylodType.PayloadType) {
    return this.attemptService.getResult(attemptId, payload.id);
  }

  @Roles(UserRoles.STUDENT)
  @UseGuards(AuthGuard, Roleguard)
  @Get(':attemptId/questions')
  questions(@Param('attemptId', new ParseIntPipe()) attemptId: number, @Payload() payload: paylodType.PayloadType) {
    return this.attemptService.getQuestions(attemptId, payload.id);
  }

  @Roles(UserRoles.INSTRACTOR)
  @UseGuards(AuthGuard, Roleguard)
  @Get('exam/:quizId/results')
  examResults(
    @Param('quizId', new ParseIntPipe()) quizId: number,
    @Query('page', new DefaultValuePipe(1), new ParseIntPipe()) page: number,
    @Query('limit', new DefaultValuePipe(20), new ParseIntPipe()) limit: number,
    @Payload() payload: paylodType.PayloadType,
  ) {
    return this.attemptService.getExamResults(quizId, payload.id, page, limit);
  }
}
