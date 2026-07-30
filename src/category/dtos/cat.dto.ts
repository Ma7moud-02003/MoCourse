import { IsNotEmpty, IsString, Length } from "class-validator";

export class CategoryDto{
    @IsNotEmpty()
    @IsString()
    @Length(5,100)
    name!:string;
}