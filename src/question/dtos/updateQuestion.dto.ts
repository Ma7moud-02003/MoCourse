import { Type } from "class-transformer";
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { UpdateChoiseDto } from "src/choice/dtos/update.dto";
import { QuestionType } from "src/utils/enums/questionTyoe.enum";

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  question!: string;

  @IsOptional()
  @IsEnum(QuestionType)
  type!: QuestionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  mark!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  order!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateChoiseDto)
  choices!:UpdateChoiseDto[];
}
