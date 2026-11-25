import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SectionEntity } from './section.entity';
import { assertNoExamAttempts } from 'src/quiz/exam-guard';
import { Repository } from 'typeorm';
import { SectionDto } from './dtos/section.dto';
import { CourseService } from 'src/course/course.service';
import { UpdateSectionDto } from './dtos/update.dto';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { EnrollmentService } from 'src/enrollment/enrollment.service';

@Injectable()
export class SectionService {
  constructor(
      @InjectRepository(SectionEntity)
    private sectinRepo: Repository<SectionEntity>,
    private courseService:CourseService,
     @Inject(forwardRef(() => EnrollmentService))
           private readonly enrollService: EnrollmentService
  ){}

/**
 * Add new section
 * @param dto of section
 * @returns successfull added section message 
 */
  public async  addSection(dto:SectionDto,InsId:number){
   if (!dto.title || dto.order == null || dto.courseId == null) {
    throw new BadRequestException('Required Value Not Found');
}
    const course=await this.courseService.getSingleCourse(dto.courseId);
    if(!course) throw new NotFoundException('Course Is Not Found')
    if(course.Instractor.id!==InsId) throw new UnauthorizedException('You are not allowed to access this course')
    const section=this.sectinRepo.create({
      title:dto.title,
      order:dto.order,
      course:{id:dto.courseId}
    })
  return await this.sectinRepo.save(section);
    
  }

// get all sections 
async getCourseSections(courseId:number,userId:number,pageNumber?:number,role?:UserRoles){
  if(!courseId) throw new BadRequestException();
  // a draft course's sections are visible only to its owner, an admin, or an already enrolled student
  if(!(await this.courseService.canViewCourse(courseId,userId,role))) throw new NotFoundException('Course not found');
  const pageNum=pageNumber??0;
  const sectionsPerPage=10;
const sections= await this.sectinRepo.find({
  where:{course:{id:courseId}}
  ,skip:sectionsPerPage*Math.max(pageNum-1,0),
    take:sectionsPerPage
});
let isEnrolled:boolean=false;
let canAccess:boolean=false;
if(userId){
  canAccess=await this.courseService.verifyingInstractorOwnTheCourse(userId,courseId);
  if(!canAccess)
  isEnrolled=await this.enrollService.verifyStudentEnrollment(userId,courseId);
}
return {data:sections,
  pageNum,sectionsPerPage,isEnrolled,canAccess
};
  }

 public async deleteSection(sectionId: number, insId: number) {
  if (!sectionId) {
    throw new BadRequestException('Required Value Unprovided');
  }
  await this.verifySectionBelongsToInstractor(sectionId, insId);
  // deleting a section removes its lessons and any exam linked to it (legacy data): refuse if attempted
  return await this.sectinRepo.manager.transaction(async (manager) => {
    await assertNoExamAttempts(manager, [{ section: { id: sectionId } }, { lesson: { section: { id: sectionId } } }], 'Students already attempted an exam in this section, so it cannot be deleted');
    return await manager.delete(SectionEntity, { id: sectionId });
  });
}

public async updateSection(dto:UpdateSectionDto,sectionId:number,insId:number){
if(!sectionId) throw new BadRequestException('Required Value Unprovided');
const section=await this.verifySectionBelongsToInstractor(sectionId,insId);
section.title=dto.title??section.title;
section.order=dto.order??section.order;
 await this.sectinRepo.save(section);
 return {
  message:'Updated Successfully'
 }

  }

 public async getSection(sectionId: number) {
  if (!sectionId) {
    throw new BadRequestException('No Provided Value');
  }

  return await this.sectinRepo.findOne({
    where: {
      id: sectionId,
    },
    relations: {
      course: {
        Instractor: true,
      },
    },
  });
}
  async verifySectionBelongsToInstractor(sectionId:number,insId:number){
    const section=await this.getSection(sectionId);
    if(!section) throw new NotFoundException('Section Is not Provided');
    if(section.course.Instractor.id!=insId) throw new UnauthorizedException('You are not allowed to access this section');
    return section;
  }
  public async getCourseBySectionId(sectioId:number){
    const section=await this.sectinRepo.findOne({
      where:{id:sectioId},relations:{course:{Instractor:true}}
    })
    return section?.course;
  }

}
