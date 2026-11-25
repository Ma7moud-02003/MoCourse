import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthGuard } from "./Guards/auth.guard";
import { Roleguard } from "./Guards/role.guard";
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { JWT_LIFETIME_SECONDS } from "src/utils/constants";

// every token is signed through this one module config; the lifetime does not come from the environment
export function jwtOptions(config: Pick<ConfigService, 'get'>) {
    return {
        global: true,
        secret: config.get<string>('JWT_SECRETKEY'),
        signOptions: { expiresIn: JWT_LIFETIME_SECONDS },
    };
}

@Module({
    imports:[

    JwtModule.registerAsync({
        inject:[ConfigService],
        useFactory:(config:ConfigService)=>jwtOptions(config)
    }),
        CloudinaryModule
    ],
    providers:[AuthGuard,Roleguard],
    exports:[AuthGuard,Roleguard,JwtModule]

})
export class CommonModule{
}
