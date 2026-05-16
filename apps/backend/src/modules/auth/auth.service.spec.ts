import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@parkshare/contracts';
import { AuthService } from './auth.service';
import { PasswordHasherService } from './password-hasher.service';
import { TokenService } from './token.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'create' | 'findByEmail' | 'toPublicUser'>
  >;
  let passwordHasher: jest.Mocked<PasswordHasherService>;
  let tokenService: jest.Mocked<TokenService>;

  const publicUser = {
    id: 'user-1',
    email: 'driver@example.com',
    name: 'Driver One',
    role: UserRole.DRIVER,
    status: UserStatus.ACTIVE,
    createdAt: '2026-05-16T09:00:00.000Z',
    updatedAt: '2026-05-16T09:00:00.000Z',
  };

  beforeEach(() => {
    usersService = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      toPublicUser: jest.fn(),
    };
    passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
    };
    tokenService = {
      signForUser: jest.fn(),
      verifyAccessToken: jest.fn(),
    } as jest.Mocked<TokenService>;

    authService = new AuthService(
      usersService as unknown as UsersService,
      passwordHasher,
      tokenService,
    );
  });

  it('registers a driver and returns a public user with an access token', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('scrypt$hash');
    usersService.create.mockResolvedValue({
      ...publicUser,
      passwordHash: 'scrypt$hash',
      createdAt: new Date(publicUser.createdAt),
      updatedAt: new Date(publicUser.updatedAt),
    });
    usersService.toPublicUser.mockReturnValue(publicUser);
    tokenService.signForUser.mockResolvedValue('signed-token');

    await expect(
      authService.register({
        email: 'DRIVER@example.com',
        name: 'Driver One',
        password: 'CorrectHorseBatteryStaple1!',
        role: UserRole.DRIVER,
      }),
    ).resolves.toEqual({
      user: publicUser,
      accessToken: 'signed-token',
    });

    expect(usersService.findByEmail).toHaveBeenCalledWith('driver@example.com');
    expect(usersService.create).toHaveBeenCalledWith({
      email: 'driver@example.com',
      name: 'Driver One',
      passwordHash: 'scrypt$hash',
      role: UserRole.DRIVER,
    });
  });

  it('allows a simple six-character password during registration', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('scrypt$hash');
    usersService.create.mockResolvedValue({
      ...publicUser,
      passwordHash: 'scrypt$hash',
      createdAt: new Date(publicUser.createdAt),
      updatedAt: new Date(publicUser.updatedAt),
    });
    usersService.toPublicUser.mockReturnValue(publicUser);
    tokenService.signForUser.mockResolvedValue('signed-token');

    await expect(
      authService.register({
        email: 'driver@example.com',
        name: 'Driver One',
        password: 'samdar',
        role: UserRole.DRIVER,
      }),
    ).resolves.toEqual({
      user: publicUser,
      accessToken: 'signed-token',
    });
  });

  it('rejects registration when the email already exists', async () => {
    usersService.findByEmail.mockResolvedValue({
      ...publicUser,
      passwordHash: 'scrypt$hash',
      createdAt: new Date(publicUser.createdAt),
      updatedAt: new Date(publicUser.updatedAt),
    });

    await expect(
      authService.register({
        email: 'driver@example.com',
        name: 'Driver One',
        password: 'CorrectHorseBatteryStaple1!',
        role: UserRole.DRIVER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials', async () => {
    const persistedUser = {
      ...publicUser,
      passwordHash: 'scrypt$hash',
      createdAt: new Date(publicUser.createdAt),
      updatedAt: new Date(publicUser.updatedAt),
    };
    usersService.findByEmail.mockResolvedValue(persistedUser);
    passwordHasher.verify.mockResolvedValue(true);
    usersService.toPublicUser.mockReturnValue(publicUser);
    tokenService.signForUser.mockResolvedValue('signed-token');

    await expect(
      authService.login({
        email: 'driver@example.com',
        password: 'CorrectHorseBatteryStaple1!',
      }),
    ).resolves.toEqual({
      user: publicUser,
      accessToken: 'signed-token',
    });
  });

  it('rejects login with invalid credentials', async () => {
    usersService.findByEmail.mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'missing@example.com',
        password: 'CorrectHorseBatteryStaple1!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
