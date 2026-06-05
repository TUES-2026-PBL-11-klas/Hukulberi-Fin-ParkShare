import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordHasherService } from './password-hasher.service';
import { TokenService } from './token.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PasswordHasherService, TokenService],
  exports: [JwtAuthGuard, TokenService, UsersModule],
})
export class AuthModule {}
