import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CertificateEntity } from './certificate.entity';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/utils/enums/notification.enum';

@Injectable()
export class CertificateService {
    constructor(
        @InjectRepository(CertificateEntity)
        private certificateRepo:Repository<CertificateEntity>,
        private notifiService:NotificationsService
    ){}

    /**
     * creating certificate after completing course  
     * @param studentId 
     * @param courseId 
     * @param courseTitle 
     * @param completedAt 
     */
public async creatCertification(studentId:number,courseId:number,
                              courseTitle:string,completedAt:Date){
const existedCertificate=await this.certificateRepo.findOne({
    where:{student:{id:studentId},course:{id:courseId}}
});
if(existedCertificate) return {message:'الشهاده موجوده بالفعل'};
 const certificateNumber=`Mo-${randomBytes(4).toString('hex').toUpperCase()}`;
 const certificate=this.certificateRepo.create({
    courseTitle:courseTitle,
    certificateNumber,
    student:{id:studentId},
    course:{id:courseId},
    issuedAt:new Date(),
    completedAt
 })
 const cer=await this.certificateRepo.save(certificate);
  //creating notification for instractor
    const certificateId=cer.id; 
         await this.notifiService.creatNotification(
         certificateId,studentId,
         `اصدار شهاده`,
         `مبروك انتهائك من كورس ${courseTitle} تم اصدار شهاتك يمكنك  الان الاطلاع عليها `,
         NotificationType.CERTIFICATE
         )
         
}

/**
 * getting student certificates 
 * @param studentId 
 * @returns array of certificates
 */
public async getMyCetificates(studentId:number){
const myCrf=await this.certificateRepo.find({
    where:{student:{id:studentId}}
})
return myCrf;
}

/**
 * getting single certificate 
 * @param studentId 
 * @param cerfId 
 * @returns certificate
 */
public async getSingleCertficate(studentId:number,cerfId:number){
const certificate=await this.certificateRepo.findOne({
    where:{id:cerfId},relations:{student:true,course:true},select:{student:{id:true,fullName:true,email:true},
    course:{id:true,title:true,duration:true,Instractor:{id:true,fullName:true}}}
});
if(!certificate) throw new NotFoundException();
if(certificate.student.id!=studentId) throw new UnauthorizedException();
return certificate;
} 

/**
 * verfiying if certificate is found by this number 
 * @param certificateNumber 
 * @returns certificate 
 */
public async verifyCrttificate(certificateNumber:string){
const certificate=await this.certificateRepo.findOne({
    where:{certificateNumber:certificateNumber},relations:{student:true,course:true},select:{student:{id:true,fullName:true,email:true},
    course:{id:true,title:true,duration:true,Instractor:{id:true,fullName:true}}}
});
if(!certificate) return {message:'لا يوجد شهاده مخصصه لهذا الكود'};
return certificate;
}
}
