import { IsNotEmpty, IsNumber, IsPositive } from "class-validator";
export class UpdateProgressDto{
@IsNotEmpty()
@IsNumber()
@IsPositive()
lessonId!:number;
@IsNotEmpty()
@IsNumber()
@IsPositive()
lastPosition!:number;
}