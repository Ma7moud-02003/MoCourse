import { BadRequestException, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRoles } from "src/utils/enums/userRole.enum";
import { PayloadType } from "src/utils/types/paylod.type";
@Injectable()
export class Roleguard implements CanActivate {
    constructor(private ref: Reflector) { }
    async canActivate(context: ExecutionContext) {
  const roles:UserRoles[]|undefined=this.ref.getAllAndOverride('roles',[context.getHandler(),context.getClass()]);
  if(!roles||roles.length==0) return true;
  const req=context.switchToHttp().getRequest();
  const payload:PayloadType=req['user'];
  if(!payload) throw new BadRequestException();
  const role=payload.role;
  if(roles.includes(role)) 
    return true 
   else throw new UnauthorizedException();

}    
}
 
