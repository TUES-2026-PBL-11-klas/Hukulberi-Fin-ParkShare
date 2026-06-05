import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PublicUserDto, UserRole, UserStatus } from '@parkshare/contracts';
import { PrismaService } from '../prisma/prisma.service';

interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole.DRIVER | UserRole.HOST;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
      },
    });
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  toPublicUser(user: User): PublicUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      status: user.status as UserStatus,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
