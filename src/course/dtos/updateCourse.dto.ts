import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, ValidateIf, IsNumber, IsString, Length, Min,Max } from "class-validator";
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


    // null / "" / "null" / 0 removes the discount; any other value must be 100..10000
    @IsOptional()
    @Transform(({ value }) => (value === undefined ? undefined : value === null || value === '' || value === 'null' ? 0 : Number(value)))
    @ValidateIf((o) => o.discountPrice !== 0)
    @Min(100)
    @Max(10000)
    @IsNumber()
    discountPrice!:number|null

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
