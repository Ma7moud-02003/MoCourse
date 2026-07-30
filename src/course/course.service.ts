import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CouurseDto } from './dtos/course.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { InjectRepository } from '@nestjs/typeorm';
import { CourseEntity } from './course.entity';
import { Repository } from 'typeorm';
import { PayloadType } from 'src/utils/types/paylod.type';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { UpdateCouurseDto } from './dtos/updateCourse.dto';

@Injectable()
export class CourseService {
    constructor(
        @InjectRepository(CourseEntity)
        private courseRepo:Repository<CourseEntity>,
        private cloudinaryServive:CloudinaryService){

    }
/**
 * add new course
 * @param dto 
 * @param file 
 * @param insId 
 * @returns  course created 
 */

public async addNewCourse(dto:CouurseDto,file:Express.Multer.File,insId:number){
const image=await this.cloudinaryServive.uploadFile(file);
const course=this.courseRepo.create({
title:dto.title,
describtion:dto.describtion,
price:dto.price,
thumbnail:image.secure_url,
discountPrice:dto.discountPrice,
Instractor:{id:insId},
duration:dto.duration,
publicId:image.public_id,
covers:dto.covers,
category:{id:dto.categoryId}
})
return this.courseRepo.save(course);
}

/**
 * get single course by id
 * @param courseId 
 * @returns course 
 */
public async getSingleCourse(courseId:number){
const course=await this.courseRepo.findOne({where:{
id:courseId
},relations:{
Instractor:true,
category:true
},select:{
    Instractor:{
        id:true
    },
    category:{
        id:true
    }
}
})
if(!course) throw new NotFoundException('Course not found with this id');
return course;
}



/**
 * Update Course bt instractor
 * @param updateDto 
 * @param courseId 
 * @param insId 
 * @param file 
 * @returns updated course
 */
public async updateCourse(updateDto:UpdateCouurseDto,courseId:number,insId:number,role:UserRoles,file?:Express.Multer.File){
if(!updateDto||!courseId||!insId) throw new BadRequestException('requred value are missed')
let course=await this.getSingleCourse(courseId);
if(role!=UserRoles.ADMIN){
if(course.Instractor.id!=insId) throw new UnauthorizedException('Access Denied You are not allowed to access this course');
}
if(file){ const image=await this.cloudinaryServive.uploadFile(file)
    course.thumbnail=image.secure_url??course.thumbnail;
    course.publicId=image.public_id??course.publicId
}
course.title=updateDto.title??course.title;
course.describtion=updateDto.describtion??course.describtion;
course.level=updateDto.level??course.level;
course.duration=updateDto.duration??course.duration;
course.price=updateDto.price??course.price;
course.discountPrice=updateDto.discountPrice??course.discountPrice;
course.covers=updateDto.covers??course.covers;
course.isPublished=updateDto.isPublished??course.isPublished;
course.category.id=updateDto.categoryId??course.category.id
return await this.courseRepo.save(course);
}

/**
 * Delete Course y Ins Or Admin
 * @param courseId 
 * @param insId 
 * @param role 
 * @returns Course Deleted
 */

public async deleteCourse(courseId:number,insId:number,role:UserRoles){
if(!courseId||!insId||!role) throw new BadRequestException('requred value are missed');
const course=await this.getSingleCourse(courseId);
if(role!=UserRoles.ADMIN){
if(course.Instractor.id!=insId) throw new UnauthorizedException('Access Denied You are not allowed to access this course');
}
return 'course removed successfully'
// return await this.courseRepo.remove(course);
}

/**
 *  get courses for signed students => it will be updated after that for filter and pagenation
 * @returns all courses
 */
public async getAllCourses(){
 return await  this.courseRepo.find({
    relations:{
    category:true,Instractor:true
    },
    select:{
    id:true,title:true,price:true,discountPrice:true,thumbnail:true,createdAt:true,
    category:{name:true},Instractor:{id:true,fullName:true,avatar:true}
    }
 });
    }

    public async getCorseDetails(courseId:number){
    return await  this.courseRepo.findOne({
    where:{id:courseId},
    relations:{
    category:true,Instractor:true
    },
    select:{
    Instractor:{id:true,fullName:true,avatar:true}
    }
 });
    }

/**
 *  get courses belongs to Instarctor => it will be updated after that for filter and pagenation
 * @returns all courses belongs to Instarctor
 */
public async getInsCourses(payload:PayloadType){
if(!payload.id&&!payload.role) throw new BadRequestException();
const id=payload.id;
return await  this.courseRepo.find({where:{Instractor:{id}},
    relations:{
        Instractor:true
    },
     select:{
    id:true,title:true,price:true,discountPrice:true,thumbnail:true,createdAt:true,
     }
});
}

/**
 *  Get corse details for every one
 * @param courseId 
 * @returns  Course details
 */
public async getCourseDetails(courseId:number){
if(!courseId) throw new NotFoundException();
const course=await this.courseRepo.findOne({
    where:{id:courseId},
    relations:{
        Instractor:true,
        category:true
    },select:{
        Instractor:{
            id:true,
            avatar:true,
           fullName:true
        },
    }
})
if(!course) throw new NotFoundException();
return course;
}

}
