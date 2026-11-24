import { createParamDecorator,ExecutionContext } from "@nestjs/common";
import { PayloadType } from "src/utils/types/paylod.type";

export const Payload=createParamDecorator((data,context:ExecutionContext)=>{
const request=context.switchToHttp().getRequest();
const payload:PayloadType=request['user'];
return payload;
})

