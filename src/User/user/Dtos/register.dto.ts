import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { UserRoles } from "src/utils/enums/userRole.enum";

export class RegisterDto{
@IsOptional()
@MaxLength(100)
@IsString() 
fullName:string|undefined;

@MaxLength(100)
@IsString() 
@IsNotEmpty()
email:string|undefined;

@MinLength(6)
@MaxLength(150)
@IsString() 
@IsNotEmpty()
password:string|undefined;
@IsOptional()
role!:UserRoles
@IsOptional()
avatar!:string

}