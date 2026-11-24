import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";
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
    @Min(100)
    @Max(10000)
    @IsNumber()
    @Type(()=>Number)
    price!:number;

    @IsNotEmpty()
    @Type(()=>Number)
    @IsNumber()
    @Min(5)
    @Max(1000)
    duration!:number;
    
    @IsNotEmpty()
    @IsArray()
    covers!:string[];


    @Min(100)
    @Max(10000)
    @IsOptional()
    @Type(()=>Number)
    @IsNumber()
    discountPrice!:number

    @IsNotEmpty()
    @IsBoolean()
    @Type(()=>Boolean)
    isPublished!:boolean

@IsArray()
 @IsNotEmpty()
  requirements!: string[];

    @IsNotEmpty()
    level!:CourseLevel

    @IsNotEmpty()
    @IsNumber()
    @Type(()=>Number)
    categoryId!:number
   }