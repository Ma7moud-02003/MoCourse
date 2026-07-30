import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRoles } from "src/utils/enums/userRole.enum";
import { PayloadType } from "src/utils/types/paylod.type";
@Injectable()
export class Roleguard implements CanActivate{
    constructor(
        private ref:Reflector,
    ){

    }
   async canActivate(context: ExecutionContext) {
    const roles:UserRoles[]=this.ref.getAllAndOverride('roles',[context.getHandler(),context.getClass()]);
    if(!roles) return true;
    const request=context.switchToHttp().getRequest();
   const payload:PayloadType=request['user'];
   if(!payload) throw new UnauthorizedException('Access Denied')
   if(roles.includes(payload.role)){
    return true
   }else{
    throw new UnauthorizedException('Access denied You are not allowed to access this')
   }

}

}    
