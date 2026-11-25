import {
  IsBoolean,
  IsInt,
  IsISO8601,
  Matches,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateQuizDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  passMark?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  /** Informational only (minutes). The real deadline for everyone is the exam's closesAt; this value is not enforced. */
  timeLimit?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:?\d{2})$/i, { message: 'opensAt must include a time zone offset' })
  opensAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:?\d{2})$/i, { message: 'closesAt must include a time zone offset' })
  closesAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  /** Stored for compatibility only. Exams allow ONE attempt per student, and the first result stands. This value is not used. */
  maxAttempts?: number;

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

  @IsOptional()
  @IsString()
  instructions?: string;
}
