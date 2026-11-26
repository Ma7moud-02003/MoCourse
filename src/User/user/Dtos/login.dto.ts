import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto{


@MaxLength(100)
@IsString() 
@IsNotEmpty()
email:string|undefined;

@MinLength(6)
@MaxLength(150)
@IsString() 
@IsNotEmpty()
password:string|undefined;


}
