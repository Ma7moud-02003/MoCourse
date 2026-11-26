import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsPositive, Min } from "class-validator";
export class UpdateProgressDto{
@IsNotEmpty()
@IsNumber()
@IsPositive()
lessonId!:number;
// seconds from the start of the lesson; 0 is allowed (student went back to the beginning)
@IsNumber()
@Min(0)
lastPosition!:number;
// only used by pdf/text lessons (they have no length): true means the student finished the lesson.
// Ignored for video lessons, which complete by watching 90%.
@IsOptional()
@IsBoolean()
completed?:boolean;
}
