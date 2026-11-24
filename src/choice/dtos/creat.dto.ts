import { IsBoolean, IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class CreateChoiceDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;

  @IsInt()
  @Min(1)
  order!: number;
}