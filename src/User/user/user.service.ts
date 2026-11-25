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
import { PaymentinfoService } from 'src/instructor-payment-info/paymentinfo/paymentinfo.service';

@Injectable()
export class UserService {
    constructor(
    @InjectRepository(UserEntity)
    private userRepo:Repository<UserEntity>,
    private jwtService:JwtService,
    private payment:PaymentinfoService
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
const paymentInfo=await this.payment.getInsPatmentInfo(id);
return {personalInfo:other,paymentInfo};
}

public getAllUsers():Promise<any[]>{
  
  return this.userRepo.find();
}

/**
 * Update User 
 * @param id 
 * @param dto 
 * @returns successfull messge
 */
async updateUser(id:number,dto:UpdateUserDto){
if(!dto.fullName&&!dto.password) throw new BadRequestException('No Data To Update');
const user=await this.userRepo.findOne({where:{id}});
if(!user) throw new NotFoundException();
let {fullName,password}=dto;
user.fullName=fullName??user.fullName;
if(password){
  const hashed=await bcrypt.hash(password,10);
  user.password=hashed;
}
 await this.userRepo.save(user);
 return {message:'User Updeted Successfully'}
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
await this.userRepo.manager.transaction(async (m)=>{
  const user=await m.findOne(UserEntity,{where:{id},lock:{mode:'pessimistic_write'}});
  if(!user) throw new NotFoundException();
  const attempts=await m.count(QuizAttemptEntity,{where:{user:{id}}});
  if(attempts>0) throw new ConflictException('This account has exam attempts, so it cannot be deleted');
  await m.delete(UserEntity,id);
});
return {message:'User Deleted Successfully'};
}





}
