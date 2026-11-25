import {
  IsBoolean,
  IsInt,
  IsISO8601,
  Matches,
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

  @IsOptional()
  @IsInt()
  @Min(1)
  /** Informational only (minutes). The real deadline for everyone is the exam's closesAt; this value is not enforced. */
  timeLimit?: number; // بالدقائق (optional: defaults to the window length)

  // exam window, full date-time with explicit offset, e.g. 2026-01-01T09:00:00+02:00
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:?\d{2})$/i, { message: 'opensAt must include a time zone offset' })
  opensAt!: string;

  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:?\d{2})$/i, { message: 'closesAt must include a time zone offset' })
  closesAt!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  /** Stored for compatibility only. Exams allow ONE attempt per student, and the first result stands. This value is not used. */
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
  /** Stored for compatibility only. A student always sees the result after submitting (or after the exam closes). This value is not used. */
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
