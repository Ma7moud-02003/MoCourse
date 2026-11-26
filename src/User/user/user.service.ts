import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from '../user.entity';
import { Repository } from 'typeorm';
import { RegisterDto } from './Dtos/register.dto';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './Dtos/login.dto';
import { UserRoles } from 'src/utils/enums/userRole.enum';
import { DEFAULT_AVATARS,  } from 'src/utils/constants';
import { JwtService } from '@nestjs/jwt';
import { PayloadType } from 'src/utils/types/paylod.type';
import { QuizAttemptEntity } from 'src/quiz-attempt/quiz-attemp.entity';
import { UpdateUserDto } from './Dtos/update.dto';
import { pageResult, parsePaging } from 'src/utils/pagination';
import { CourseEntity } from 'src/course/course.entity';
import { EnrollmentEntity } from 'src/enrollment/enrollment.entity';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { assertImageFile, MAX_AVATAR_BYTES } from 'src/utils/upload-validation';
import { PaymentinfoService } from 'src/instructor-payment-info/paymentinfo/paymentinfo.service';

@Injectable()
export class UserService {
    constructor(
    @InjectRepository(UserEntity)
    private userRepo:Repository<UserEntity>,
    private jwtService:JwtService,
    private payment:PaymentinfoService,
    private cloudinary:CloudinaryService
    ){
    }

    // register function imortant 
 public async register(dto: RegisterDto) {
  const { fullName, email, password } = dto;
  // public sign-up can never create an admin; only student or instructor
  const role = dto.role === UserRoles.INSTRACTOR ? UserRoles.INSTRACTOR : UserRoles.STUDENT;
  const userInDatabase = await this.userRepo.findOne({ where: { email }});
  if (userInDatabase) {
    throw new BadRequestException('Email is already used');
  }
  if(password){
    const hashedPassword = await bcrypt.hash(password, 10);
  const avatar=this.getAvatar(role);
  let newUser = this.userRepo.create({
    fullName,
    email,
    password: hashedPassword,
    role,
    avatar,
  });
   newUser=  await this.userRepo.save(newUser);
  const payload:PayloadType={id:newUser.id,role:newUser.role};
  console.log(payload);
 const token=await this.generateToken(payload)
  return {
    message: 'Account Registered Successfully',
    token:token
  };
  }
}
/**
 * 
 * @param LoginDto 
 * @returns  Jwt-Token
 */

 getAvatar(role:string):string{
  let avatar = '';
  switch (role) {
    case UserRoles.ADMIN:
      avatar = DEFAULT_AVATARS.ADMIN;
      break;
    case UserRoles.INSTRACTOR:
      avatar = DEFAULT_AVATARS.INSTRUCTOR;
      break;
    case UserRoles.STUDENT:
      avatar =DEFAULT_AVATARS.STUDENT
      break;
  }
  return avatar;
 }

public async login(dto: LoginDto) {
  const { email, password } = dto;
  const userIfExist = await this.userRepo.findOne({ where: { email } });
  if (!userIfExist) {
    throw new BadRequestException('Invalid Cardinality');
  }
  const isPasswordTrue = password ? await bcrypt.compare(password, userIfExist.password) : false;
  if (!isPasswordTrue) {
    throw new BadRequestException('Invalid Cardinality');
  }
  const payload = { id: userIfExist.id, role: userIfExist.role };
  const token = await this.generateToken(payload);
  return {
    message: 'Account logged Successfully',
    token: token
  };
}

/**
 * 
 * @param payload 
 * @returns  token
 */
// generating token
async generateToken(payload:PayloadType){
  return await this.jwtService.signAsync(payload);
} 


public async getInstractorInfo(id:number){
const user=await this.userRepo.findOne({where:{id}});
if(!user)  throw new NotFoundException('User Not Found');
const {password ,...other}=user;
// payment info exists only for instructors who added it: students and new instructors get null, not a 404
const paymentInfo=user.role===UserRoles.INSTRACTOR ? await this.payment.findInsPaymentInfo(id) : null;
return {personalInfo:other,paymentInfo};
}

// role lookup without payment info: instructor info requires a payment_info row, which students never have
public async getUserRole(id:number):Promise<UserRoles>{
const user=await this.userRepo.findOne({where:{id},select:{id:true,role:true}});
if(!user)  throw new NotFoundException('User Not Found');
return user.role;
}

/** admin list, paginated, oldest account first. The password hash is never returned. */
public async getAllUsers(page?:unknown,limit?:unknown){
  const paging=parsePaging(page,limit);
  const [users,total]=await this.userRepo.findAndCount({order:{id:'ASC'},skip:paging.skip,take:paging.limit});
  const items=users.map(({password,...other})=>other);
  return pageResult(items,total,paging.page,paging.limit);
}

/**
 * Update User 
 * @param id 
 * @param dto 
 * @returns successfull messge
 */
async updateUser(id:number,dto:UpdateUserDto,requireCurrentPassword:boolean=false){
if(!dto.fullName&&!dto.password) throw new BadRequestException('No Data To Update');
const user=await this.userRepo.findOne({where:{id}});
if(!user) throw new NotFoundException();
let {fullName,password}=dto;
if(password&&requireCurrentPassword){
  const same=dto.currentPassword?await bcrypt.compare(dto.currentPassword,user.password):false;
  if(!same) throw new BadRequestException('Current password is incorrect');
}
user.fullName=fullName??user.fullName;
if(password){
  const hashed=await bcrypt.hash(password,10);
  user.password=hashed;
}
 await this.userRepo.save(user);
 return {message:'User Updeted Successfully'}
}

/**
 * Delete the logged-in user's own account. Needs the current password.
 * An instructor who still has courses (and so maybe students) cannot delete the account.
 */
async deleteOwnAccount(id:number,password:string){
if(!password) throw new BadRequestException('Password is required');
const user=await this.userRepo.findOne({where:{id}});
if(!user) throw new NotFoundException();
const ok=await bcrypt.compare(password,user.password);
// 400, not 401: a wrong password must not look like an expired login to the frontend
if(!ok) throw new BadRequestException('Password is incorrect');
if(user.role===UserRoles.INSTRACTOR){
  const courses=await this.userRepo.manager.count(CourseEntity,{where:{Instractor:{id}}});
  if(courses>0){
    const students=await this.userRepo.manager.count(EnrollmentEntity,{where:{course:{Instractor:{id}}}});
    throw new ConflictException(`This account still has ${courses} course(s) and ${students} enrolled student(s), so it cannot be deleted`);
  }
}
return this.deleteUser(id);
}

/**
 * Change the profile photo of the logged-in user. Only the new image's URL is stored.
 */
async updateAvatar(id:number,file:Express.Multer.File|undefined){
assertImageFile(file,'Avatar');
if(file!.size>MAX_AVATAR_BYTES) throw new BadRequestException('Avatar image is too large (max 2 MB)');
const user=await this.userRepo.findOne({where:{id}});
if(!user) throw new NotFoundException();
const image=await this.cloudinary.uploadFile(file!,'user/avatars','image');
user.avatar=image.secure_url;
await this.userRepo.save(user);
return {message:'Avatar Updated Successfully',avatar:user.avatar};
}

/**
 * delete user
 * @param id 
 * @returns  seccessfull deleted message
 */
async deleteUser(id:number){
// An account with exam attempts cannot be deleted: the attempts cascade with the user and the results
// would be lost. The user row is locked first, so an attempt being created at the same moment either
// is seen by the count or waits for this transaction (its foreign key needs the same row).
try{
await this.userRepo.manager.transaction(async (m)=>{
  const user=await m.findOne(UserEntity,{where:{id},lock:{mode:'pessimistic_write'}});
  if(!user) throw new NotFoundException();
  const attempts=await m.count(QuizAttemptEntity,{where:{user:{id}}});
  if(attempts>0) throw new ConflictException('This account has exam attempts, so it cannot be deleted');
  await m.delete(UserEntity,id);
});
}catch(e:any){
  // the database refuses to delete an account that still has enrollments or courses: say so clearly (nothing is cascaded)
  if(e?.code==='23503' || e?.driverError?.code==='23503') throw new ConflictException('This account still has enrollments or courses, so it cannot be deleted');
  throw e;
}
return {message:'User Deleted Successfully'};
}





}
