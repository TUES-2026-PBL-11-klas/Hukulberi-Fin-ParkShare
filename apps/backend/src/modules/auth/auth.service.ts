import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus as PrismaUserStatus } from '@prisma/client';
import {
  AuthResponseDto,
  LoginRequestDto,
  RegisterRequestDto,
  UserRole,
} from '@parkshare/contracts';
import { PasswordHasherService } from './password-hasher.service';
import { TokenService } from './token.service';
import { UsersService } from '../users/users.service';

const MIN_PASSWORD_LENGTH = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
  ) {}

  async register(input: RegisterRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(input.email);
    const name = this.normalizeName(input.name);
    const role = input.role ?? UserRole.DRIVER;

    this.assertAllowedSelfSignupRole(role);
    this.assertPassword(input.password);

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const user = await this.usersService.create({
      email,
      name,
      passwordHash,
      role,
    });
    const publicUser = this.usersService.toPublicUser(user);

    return {
      user: publicUser,
      accessToken: await this.tokenService.signForUser(publicUser),
    };
  }

  async login(input: LoginRequestDto): Promise<AuthResponseDto> {
    const email = this.normalizeEmail(input.email);
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.passwordHasher.verify(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches || user.status !== PrismaUserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const publicUser = this.usersService.toPublicUser(user);

    return {
      user: publicUser,
      accessToken: await this.tokenService.signForUser(publicUser),
    };
  }

  private normalizeEmail(email: string): string {
    const normalizedEmail = email?.trim().toLowerCase();

    if (
      !normalizedEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      throw new BadRequestException('A valid email is required');
    }

    return normalizedEmail;
  }

  private normalizeName(name: string): string {
    const normalizedName = name?.trim();

    if (!normalizedName || normalizedName.length > 120) {
      throw new BadRequestException(
        'Name must be between 1 and 120 characters',
      );
    }

    return normalizedName;
  }

  private assertPassword(password: string): void {
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
  }

  private assertAllowedSelfSignupRole(role: UserRole): void {
    if (role !== UserRole.DRIVER && role !== UserRole.HOST) {
      throw new BadRequestException('Only driver and host signup is allowed');
    }
  }
}
