import { IsInt, Min } from 'class-validator';

export class SaveAnswerDto {
  @IsInt()
  @Min(1)
  questionId!: number;

  @IsInt()
  @Min(1)
  choiceId!: number;
}
