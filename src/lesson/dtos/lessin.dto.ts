import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonType } from 'src/utils/enums/lessonType.enum';

export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

   @IsString()
  @IsOptional()
  @MaxLength(1000)
  description!: string;


  @IsEnum(LessonType)
  type!: LessonType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  order!: number;

  @Type(() => Number)
  @IsInt()
  sectionId!: number;

  @Type(() => Boolean)
  @IsBoolean()
  isPreview!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;
}