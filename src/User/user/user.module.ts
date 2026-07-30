import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user.entity';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CommonModule } from 'src/common/common.module';


@Module({
  controllers: [UserController],
  providers: [UserService],
    imports:[TypeOrmModule.forFeature([UserEntity]),
    CommonModule
    
  ]
  
})
export class UserModule {}
