import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { QuizTargetType } from 'src/utils/enums/quizTarget.enum';

export class CreateQuizDto {

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  passMark!: number;
   @IsInt()
  @Min(0)
  @Max(200)
 totalMarks!:number

  @IsInt()
  @Min(1)
  timeLimit!: number; // بالدقائق

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttempts?: number;


  @IsNotEmpty()
  quizTarget?: QuizTargetType;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  shuffleChoices?: boolean;

  @IsOptional()
  @IsBoolean()
  showResultImmediately?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsNotEmpty()
  @IsInt()
  courseId!: number;

  @IsOptional()
  instructions?:string;
  @IsOptional()
  @IsInt()
  sectionId?: number;

  @IsOptional()
  @IsInt()
  lessonId?: number;
}