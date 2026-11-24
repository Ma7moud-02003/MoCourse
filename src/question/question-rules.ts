import { BadRequestException } from '@nestjs/common';
import { QuestionType } from 'src/utils/enums/questionTyoe.enum';

export const MCQ_MIN_CHOICES = 2;
export const MCQ_MAX_CHOICES = 6;

/**
 * Check the final choice set of a question.
 * mcq: 2 to 6 choices, exactly one correct.
 * true_false: exactly 2 choices, exactly one correct.
 */
export function validateChoices(type: QuestionType, choices: { isCorrect?: boolean }[] | undefined) {
  const list = choices ?? [];
  if (type === QuestionType.TRUE_FALSE) {
    if (list.length !== 2) {
      throw new BadRequestException('A true/false question needs exactly 2 choices');
    }
  } else if (list.length < MCQ_MIN_CHOICES || list.length > MCQ_MAX_CHOICES) {
    throw new BadRequestException(`A multiple choice question needs ${MCQ_MIN_CHOICES} to ${MCQ_MAX_CHOICES} choices`);
  }
  const correct = list.filter((c) => c.isCorrect === true).length;
  if (correct !== 1) {
    throw new BadRequestException('A question needs exactly one correct choice');
  }
}
