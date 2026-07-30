import { IsArray, IsBoolean, IsOptional, IsNumber, IsString, Length, Min,Max } from "class-validator";
import { CourseLevel } from "src/utils/enums/level.enum";

export class UpdateCouurseDto{

    @IsOptional()
    @IsString()
    @Length(5,150)
    title!:string;

    @IsOptional()
    @IsString()
    @Length(20,4000)
    describtion!:string;

    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    price!:number;

    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(1000)
    duration!:number;
    
    @IsOptional()
    @IsArray()
    covers!:string[];


    @Min(100)
    @Max(10000)
    @IsOptional()
    @IsNumber()
    discountPrice!:number

    @IsOptional()
    @IsBoolean()
    isPublished!:boolean

    @IsOptional()
    level!:CourseLevel

    @IsOptional()
    @IsNumber()
    categoryId!:number
   
    
}