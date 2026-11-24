import {  IsNotEmpty, IsNumber, IsPositive } from "class-validator";

export class CourseIdDto{
    @IsNotEmpty()
    @IsNumber()
    courseId:number|undefined;
}