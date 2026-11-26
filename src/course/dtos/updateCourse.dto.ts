import { Type } from "class-transformer/types/decorators/type.decorator";
import { IsArray, IsBoolean, IsOptional, IsNumber, IsString, Length, Min,Max } from "class-validator";
import { CourseLevel } from "src/utils/enums/level.enum";

export class UpdateCouurseDto{

    @IsOptional()
    @IsString()
    @Length(5,150)
    title!:string;


    
    @IsArray()
     @IsOptional()
    requirements!: string[];

    @IsOptional()
    @IsString()
    @Length(20,4000)
    describtion!:string;

    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(10000)
    @Type(()=>Number)
    price!:number;

    @IsOptional()
    @IsNumber()
    @Min(5)
    @Max(1000)
    @Type(()=>Number)
    duration!:number;
    
    @IsOptional()
    @IsArray()
    covers!:string[];


    @Min(100)
    @Max(10000)
    @IsOptional()
    @IsNumber()
    @Type(()=>Number)
    discountPrice!:number

    @IsOptional()
    @IsBoolean()
      @Type(()=>Boolean)
    isPublished!:boolean

    @IsOptional()
    level!:CourseLevel

    @IsOptional()
    @IsNumber()
    @Type(()=>Number)
    categoryId!:number
   
    
}
