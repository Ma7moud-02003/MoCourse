import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard } from "./Guards/auth.guard";
import { Roleguard } from "./Guards/role.guard";
import { CloudinaryModule } from './cloudinary/cloudinary.module';


@Module({
    imports:[

    JwtModule.registerAsync({
        inject:[ConfigService],
        useFactory:(config:ConfigService)=>{
return{
    global:true,
    secret:config.get<string>('JWT_SECRETKEY'),
    signOptions:{expiresIn:config.get<number>('JWT_EXPIREDIN')}
}
        }
    }),
        CloudinaryModule
    ],
    providers:[AuthGuard,Roleguard],
    exports:[AuthGuard,Roleguard,JwtModule]

})
export class CommonModule{
}
