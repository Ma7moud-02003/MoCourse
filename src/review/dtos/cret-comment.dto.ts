import { IsInt, IsNotEmpty, IsNumber, IsString, Length, Max, Min } from "class-validator";

export class CreatCommentDto{

    @IsNotEmpty()
    @IsString()
    @Length(5,200)
    comment!:string;
    @IsNotEmpty()
    @IsNumber()
    @IsInt()
    @Min(0)
    @Max(5)
    rateing!:number
}
