import {  IsOptional, IsString, MaxLength, MinLength } from "class-validator";


export class UpdateUserDto{
@IsOptional()
@MaxLength(100)
@IsString() 
fullName:string|undefined;



@MinLength(6)
@MaxLength(150)
@IsString() 
@IsOptional()
password:string|undefined;

}
