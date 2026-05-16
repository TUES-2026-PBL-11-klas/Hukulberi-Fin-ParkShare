export enum UserRole {
  DRIVER = 'DRIVER',
  HOST = 'HOST',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface PublicUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterRequestDto {
  email: string;
  name: string;
  password: string;
  role?: UserRole.DRIVER | UserRole.HOST;
}

export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  user: PublicUserDto;
  accessToken: string;
}
