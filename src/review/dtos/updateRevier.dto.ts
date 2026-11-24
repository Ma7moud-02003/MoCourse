import { IsNotEmpty, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class UpdateCommentDto{

    @IsOptional()
    @IsString()
    @Length(5,200)
    comment!:string;
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(5)
    rateing!:number
}