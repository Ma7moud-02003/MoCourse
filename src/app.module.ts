import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './User/user/user.module';
import { CategoryModule } from './category/category.module';
import { CourseModule } from './course/course.module';
import { SectionModule } from './section/section.module';
import { LessonModule } from './lesson/lesson.module';
import { EnrollmentModule } from './enrollment/enrollment.module';
import { ProgressModule } from './progress/progress.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from './User/user.entity';
import { CourseEntity } from './course/course.entity';
import { CategoryEntity } from './category/category.entity';
import { SectionEntity } from './section/section.entity';
import { LessonsEntity } from './lesson/lessons.entity';
import { EnrollmentEntity } from './enrollment/enrollment.entity';
import { ProgressEntity } from './progress/progress.entity';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PurchaseMoule } from './Purchase/purchase.module';
import { PurchaseEntity } from './Purchase/purchase.entity';
import { PaymentinfoModule } from './instructor-payment-info/paymentinfo/paymentinfo.module';
import { PaymentInfoEntity } from './instructor-payment-info/paymentInfo.entity';



@Module({
  imports: [

   ConfigModule.forRoot({
      isGlobal: true,
     envFilePath: `.env.${process.env.NODE_ENV}`
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          username: config.get<string>('DB_USERNAME'),
          password: config.get<string>('DB_PASSWORD'),
          database: config.get<string>('DB_DATABASE'),
          port: config.get<number>('DB_PORT'),
          type: 'postgres',
          host: 'localhost',
          synchronize: process.env.NODE_ENV !=='production',
          entities: [UserEntity,CourseEntity,CategoryEntity,SectionEntity,LessonsEntity,EnrollmentEntity,ProgressEntity,PurchaseEntity,PaymentInfoEntity]
        }
      }
    }),
     
    UserModule, CategoryModule, CourseModule, SectionModule, LessonModule, EnrollmentModule, ProgressModule,PurchaseMoule, PaymentinfoModule],
  controllers: [AppController],
  providers: [AppService,
    {
      provide:APP_INTERCEPTOR,
      useClass:ClassSerializerInterceptor
    }
  ],
})
export class AppModule { }
