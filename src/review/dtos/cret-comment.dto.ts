import { IsNotEmpty, IsNumber, IsString, Length, Max, Min } from "class-validator";

export class CreatCommentDto{

    @IsNotEmpty()
    @IsString()
    @Length(5,200)
    comment!:string;
    @IsNotEmpty()
    @IsNumber()
    @Min(0)
    @Max(5)
    rateing!:number
}