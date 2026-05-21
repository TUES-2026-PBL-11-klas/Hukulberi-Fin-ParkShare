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

export enum BookingStatus {
  HOLD = 'HOLD',
  CONFIRMED = 'CONFIRMED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
}

export interface CreateBookingRequestDto {
  spotId: string;
  startAt: string;
  endAt: string;
  amount: number;
  currency?: string;
}

export interface BookingDto {
  id: string;
  spotId: string;
  driverUserId: string;
  status: BookingStatus;
  amount: number;
  currency: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}
