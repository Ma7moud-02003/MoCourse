import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsString, Length, Max, Min } from "class-validator";
import { CourseLevel } from "src/utils/enums/level.enum";

export class CouurseDto{

    @IsNotEmpty()
    @IsString()
    @Length(5,150)
    title!:string;

    @IsNotEmpty()
    @IsString()
    @Length(20,4000)
    describtion!:string;

    @IsNotEmpty()
    @IsNumber()
    @Min(100)
    @Max(10000)
    price!:number;

    @IsNotEmpty()
    @IsNumber()
    @Min(5)
    @Max(1000)
    duration!:number;
    
    @IsNotEmpty()
    @IsArray()
    covers!:string[];


    @Min(100)
    @Max(10000)
    @IsNotEmpty()
    @IsNumber()
    discountPrice!:number

    @IsNotEmpty()
    @IsBoolean()
    isPublished!:boolean

    @IsNotEmpty()
    level!:CourseLevel

    @IsNotEmpty()
    @IsNumber()
    categoryId!:number
   
    
}