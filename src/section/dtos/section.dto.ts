import { IsNotEmpty, IsNumber, IsString, Length, Max, Min } from "class-validator";

export class SectionDto{
    @IsNotEmpty()
    @Length(5,150)
    @IsString()
    title!:string;
 
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Max(1000)
    order!:number;

    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Max(10000)
    courseId!:number;

}