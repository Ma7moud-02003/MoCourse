import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Request } from "express";
@Injectable()
export class AuthGuard implements CanActivate{
    constructor(
        private jwtService:JwtService,
        private  config:ConfigService
    ){

    }
async canActivate(context: ExecutionContext) {
    const request:Request=context.switchToHttp().getRequest();
    const [type,token]=request.headers.authorization?.split(" ")??[];
    if(token&&type=='Bearer'){
        try{
const payload=await this.jwtService.verifyAsync(
    token,{
        secret:this.config.get<string>('JWT_SECRETKEY')
    }
)
 request['user']=payload;
}catch{
    throw new   UnauthorizedException('Access Denied Token is invalid')}
    }else{
           throw new   UnauthorizedException('Access Denied Token is un Provided')}
 return true;
    }

}    