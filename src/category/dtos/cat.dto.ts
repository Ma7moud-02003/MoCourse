import { IsNotEmpty, IsString, Length } from "class-validator";

export class CategoryDto{
    @IsNotEmpty()
    @IsString()
    @Length(2,100)
    name!:string;
}
