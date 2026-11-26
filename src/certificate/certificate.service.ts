import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CertificateEntity } from './certificate.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { NotificationsService } from 'src/notifications/notifications.service';
import { NotificationType } from 'src/utils/enums/notification.enum';

const STUDENT_COURSE_UNIQUE = 'UQ_certificates_student_course';
const CERT_NUMBER_UNIQUE = 'UQ_9742ea65bce69db989c2e676936';
const EXISTS_MESSAGE = 'الشهاده موجوده بالفعل';
const MAX_NUMBER_ATTEMPTS = 5;

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
                              courseTitle:string,completedAt:Date|null){
const existedCertificate=await this.certificateRepo.findOne({
    where:{student:{id:studentId},course:{id:courseId}}
});
if(existedCertificate) return {message:EXISTS_MESSAGE};

// Two completions can pass the check above at the same time; the database unique rules decide.
// A duplicate (student, course) save means the certificate already exists. A certificateNumber
// collision just means: draw a new number and try again.
for(let attempt=0;attempt<MAX_NUMBER_ATTEMPTS;attempt++){
 const certificateNumber=`Mo-${randomBytes(6).toString('hex').toUpperCase()}`;
 const certificate=this.certificateRepo.create({
    courseTitle:courseTitle,
    certificateNumber,
    student:{id:studentId},
    course:{id:courseId},
    issuedAt:new Date(),
    completedAt
 });
 let cer:CertificateEntity;
 try{
   cer=await this.certificateRepo.save(certificate);
 }catch(e){
   if(e instanceof QueryFailedError && (e as {code?:string}).code==='23505'){
     const constraint=(e as {constraint?:string}).constraint??'';
     if(constraint===STUDENT_COURSE_UNIQUE||constraint.includes('studentId'))
       return {message:EXISTS_MESSAGE};
     if(constraint===CERT_NUMBER_UNIQUE||constraint.includes('certificateNumber'))
       continue;
   }
   throw e;
 }
  //creating notification for the student
    const certificateId=cer.id;
         await this.notifiService.creatNotification(
         certificateId,studentId,
         `اصدار شهاده`,
         `مبروك انتهائك من كورس ${courseTitle} تم اصدار شهاتك يمكنك  الان الاطلاع عليها `,
         NotificationType.CERTIFICATE
         )
 return cer;
}
throw new Error(`Could not generate a unique certificate number after ${MAX_NUMBER_ATTEMPTS} attempts`);
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
    where:{certificateNumber:certificateNumber},relations:{student:true,course:{Instractor:true}}
});
if(!certificate) return {message:'لا يوجد شهاده مخصصه لهذا الكود'};
// Any logged-in user can look a certificate up by its code, so only what is needed to check it is returned:
// number, dates, course and the student's display name. Never the student's email or any account id.
return {
    certificateNumber:certificate.certificateNumber,
    issuedAt:certificate.issuedAt,
    completedAt:certificate.completedAt,
    courseTitle:certificate.courseTitle,
    student:{fullName:certificate.student?.fullName},
    course:{title:certificate.course?.title,duration:certificate.course?.duration,Instractor:{fullName:certificate.course?.Instractor?.fullName}}
};
}
}
