import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

/**
 * For public routes that show a little more to a logged-in user.
 * It never rejects: a valid bearer token sets request.user, anything else (no token, bad or expired token)
 * leaves the request anonymous, so the route treats it exactly like a logged-out visitor.
 */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
    constructor(private jwtService: JwtService, private config: ConfigService) {}

    async canActivate(context: ExecutionContext) {
        const request: Request = context.switchToHttp().getRequest();
        const [type, token] = request.headers.authorization?.split(' ') ?? [];
        if (token && type == 'Bearer') {
            try {
                request['user'] = await this.jwtService.verifyAsync(token, { secret: this.config.get<string>('JWT_SECRETKEY') });
            } catch {
                // invalid token: stay anonymous
            }
        }
        return true;
    }
}
