import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EnrollmentEntity } from './enrollment.entity';
import { Repository } from 'typeorm';
import { CourseEntity } from 'src/course/course.entity';

@Injectable()
export class EnrollmentService {
    constructor(
        @InjectRepository(EnrollmentEntity)
        private enrollRepo:Repository<EnrollmentEntity>,
        @InjectRepository(CourseEntity)
        private courseRepo:Repository<CourseEntity>

    ){}

    /**
     * enroll course afer checking existing and publishment
     * @param courseId 
     * @param studentId 
     * @returns enrolled successsfully
     */
async enrollCourse(courseId:number,studentId:number){
if(!courseId&&!studentId) throw new BadRequestException();
const exist=await this.enrollRepo.findOne({where:{
    course:{id:courseId},
    user:{id:studentId}
}})
if(exist) throw new BadRequestException('You are alrealdy enroll this course');
const course=await this.courseRepo.findOne({where:{id:courseId}});
if(!course) throw new NotFoundException('Course is not existed')
if(!course.isPublished) throw new BadRequestException('Course is not Published Yet');
 const enroll=this.enrollRepo.create({
    course:{id:courseId},
    user:{id:studentId}
 })
 await this.enrollRepo.save(enroll);
}



 public async getStudentCourses(studentId:number){
if(!studentId) throw new BadRequestException('Id is not provided');
const courses=await this.enrollRepo.find({
    where:{
        user:{id:studentId},
    },relations:{
    course:true
    },select:{
        course:{
            id:true,thumbnail:true,title:true,createdAt:true,price:true,discountPrice:true
        }
    }
});
if(courses.length==0) return new NotFoundException('No Courses Provided For You');
return courses;
 }
}
