import { IsNotEmpty, IsNumber, IsPositive } from "class-validator";
export class CreatProgressDto{
@IsNotEmpty()
@IsNumber()
@IsPositive()
lessonId!:number;
}