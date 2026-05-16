import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type {
  AuthResponseDto,
  LoginRequestDto,
  PublicUserDto,
  RegisterRequestDto,
} from '@parkshare/contracts';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  register(@Body() body: RegisterRequestDto): Promise<AuthResponseDto> {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: LoginRequestDto): Promise<AuthResponseDto> {
    return this.authService.login(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() request: AuthenticatedRequest): PublicUserDto {
    if (!request.user) {
      throw new Error('Authenticated request is missing user context');
    }

    return request.user;
  }
}
