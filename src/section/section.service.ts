import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SectionEntity } from './section.entity';
import { Repository } from 'typeorm';
import { SectionDto } from './dtos/section.dto';
import { CourseService } from 'src/course/course.service';
import { UpdateSectionDto } from './dtos/update.dto';

@Injectable()
export class SectionService {
  constructor(
      @InjectRepository(SectionEntity)
    private sectinRepo: Repository<SectionEntity>,
    private courseService:CourseService
  ){}

/**
 * Add new section
 * @param dto of section
 * @returns successfull added section message 
 */
  public async  addSection(dto:SectionDto,InsId:number){
    if(!dto.title||!dto.order||!dto.courseId) throw new NotFoundException('Required Value Not found');
    const course=await this.courseService.getSingleCourse(dto.courseId);
    if(!course) throw new NotFoundException('Course Is Not Found')
    if(course.Instractor.id!==InsId) throw new UnauthorizedException('You are not allowed to access this course')
    const section=this.sectinRepo.create({
      title:dto.title,
      order:dto.order,
      course:{id:dto.courseId}
    })
    await this.sectinRepo.save(section);
    return {
      mesaage:'Section Added Successfully'
    }
  }

// get all sections 
  async getCourseSections(courseId:number){
const sections= await this.sectinRepo.find({
  where:{
    course:{id:courseId}
  }
});
if(sections.length==0) return new NotFoundException('No Sections Provided');
return sections;
  }

public async updateSection(dto:UpdateSectionDto,sectionId:number,insId:number){
if(!sectionId) throw new BadRequestException('Required Value Unprovided');
const section=await this.sectinRepo.findOne({
  where:{id:sectionId},relations:{
    course:{
      
      Instractor:true
    }
  },select:{
    course:{
      id:true,
      Instractor:{
        id:true
      }
    }
  }
})
if(!section) throw new NotFoundException('Section Is not Provided');
if(section.course.Instractor.id!=insId) throw new UnauthorizedException('You are not allowed to access this section');
section.title=dto.title??section.title;
section.order=dto.order??section.order;
 await this.sectinRepo.save(section);
 return {
  message:'Updated Successfully'
 }

  }

}
