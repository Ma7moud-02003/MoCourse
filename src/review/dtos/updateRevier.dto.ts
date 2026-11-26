import { IsInt, IsNumber, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class UpdateCommentDto{

    @IsOptional()
    @IsString()
    @Length(5,200)
    comment!:string;
    @IsOptional()
    @IsNumber()
    @IsInt()
    @Min(0)
    @Max(5)
    rateing!:number
}
