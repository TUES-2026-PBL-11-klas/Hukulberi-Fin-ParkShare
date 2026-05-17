import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus as PrismaUserStatus } from '@prisma/client';
import { Request } from 'express';
import { TokenService } from './token.service';
import { UsersService } from '../users/users.service';

export interface AuthenticatedRequest extends Request {
  user?: ReturnType<UsersService['toPublicUser']>;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    const payload = await this.tokenService.verifyAccessToken(token);
    const user = await this.usersService.findById(payload.sub);

    if (!user || user.status !== PrismaUserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    request.user = this.usersService.toPublicUser(user);
    return true;
  }

  private extractBearerToken(request: Request): string {
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required');
    }

    return token;
  }
}
