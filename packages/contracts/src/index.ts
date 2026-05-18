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

export interface CreateCheckoutSessionRequestDto {
  amount: number;
  currency?: string;
  name?: string;
  bookingId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreateCheckoutSessionResponseDto {
  paymentId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
}

export interface StripeWebhookResponseDto {
  received: true;
  duplicate: boolean;
  eventId: string;
}
