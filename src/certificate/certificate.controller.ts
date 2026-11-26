import { Controller, Get, Param, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { Payload } from 'src/common/Decorators/payload.decorator';
import * as paylodType from 'src/utils/types/paylod.type';
import { AuthGuard } from 'src/common/Guards/auth.guard';
import express from 'express';

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


//   @Get('login')
//   login(@Res() res: express.Response) {
//     const appId = '4556582321253838';
//   const redirectUri =
//     'http://localhost:3000/auth/facebook/callback';
// const scope = [
//   'pages_show_list',
//   'pages_read_engagement',
// ].join(',');

//   const facebookUrl =
//     `https://www.facebook.com/v26.0/dialog/oauth` +
//     `?client_id=${appId}` +
//     `&redirect_uri=${encodeURIComponent(redirectUri)}` +
//     `&response_type=code` +
//     `&scope=${encodeURIComponent(scope)}`;

//   return res.redirect(facebookUrl);
// }

}
