import { Controller, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
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
}
