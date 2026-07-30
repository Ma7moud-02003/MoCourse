import { IsOptional, IsNumber, IsString, Length, Max, Min } from "class-validator";

export class UpdateSectionDto{
    @IsOptional()
    @Length(5,150)
    @IsString()
    title!:string;
 
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1000)
    order!:number;

    

}