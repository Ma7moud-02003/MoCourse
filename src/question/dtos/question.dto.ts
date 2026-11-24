import { Type } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from "class-validator";
import { CreateChoiceDto } from "src/choice/dtos/creat.dto";
import { QuestionType } from "src/utils/enums/questionTyoe.enum";

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  question!: string;

  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsInt()
  @Min(1)
  mark!: number;

  @IsInt()
  @Min(1)
  order!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChoiceDto)
  choices!: CreateChoiceDto[];
}

export class CreateQuestionsDto {
  @IsInt()
  @Min(1)
  quizId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions!: CreateQuestionDto[];
}