import { IsNotEmpty, IsNumber, IsPositive, Min } from "class-validator";
export class UpdateProgressDto{
@IsNotEmpty()
@IsNumber()
@IsPositive()
lessonId!:number;
// seconds from the start of the lesson; 0 is allowed (student went back to the beginning)
@IsNumber()
@Min(0)
lastPosition!:number;
}
