import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonType } from 'src/utils/enums/lessonType.enum';

export class UpdateLessonDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  title!: string;

   @IsString()
  @IsOptional()
  @MaxLength(1000)
  description!: string;


  @IsOptional()
  @IsEnum(LessonType)
  type!: LessonType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;


  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPreview!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;
}