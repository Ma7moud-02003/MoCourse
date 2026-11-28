import { Controller, Get, Param, ParseIntPipe, StreamableFile, UseGuards } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { AuthGuard } from 'src/common/Guards/auth.guard';

@Controller('api/certificate/')
export class CertificateController {
constructor(
    private cerService:CertificateService
){}
@Get('myCrrtificates')
@UseGuards(AuthGuard)   
getAll(@Payload() payload:paylodType.PayloadType){
return this.cerService.getMyCetificates(payload.id);
}

@Get(':id/pdf')
@UseGuards(AuthGuard)
async getPdf(@Param('id',new ParseIntPipe) id:number,@Payload() payload:paylodType.PayloadType){
const {buffer,fileName}=await this.cerService.getCertificatePdf(payload.id,id);
return new StreamableFile(buffer,{type:'application/pdf',disposition:`attachment; filename="${fileName}"`});
}

@Get(':id')
@UseGuards(AuthGuard)   
getSingle(@Param('id',new ParseIntPipe) id:number,@Payload() payload:paylodType.PayloadType){
return this.cerService.getSingleCertficate(payload.id,id);
}

@Get('verify/:certificateNum')
@UseGuards(AuthGuard)   
verifyAndGet(@Param('certificateNum') certificateNum:string){
return this.cerService.verifyCrttificate(certificateNum);
}

}
