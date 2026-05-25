import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  Booking,
  BookingStatus as PrismaBookingStatus,
  Prisma,
} from '@prisma/client';
import {
  BookingDto,
  BookingStatus,
  CreateBookingRequestDto,
} from '@parkshare/contracts';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CURRENCY = 'eur';
const HOLD_TTL_MINUTES = 10;
const EXPIRY_POLL_MS = 60_000;

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private expiryTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      void this.expireOverdueHolds();
    }, EXPIRY_POLL_MS);
  }

  onModuleDestroy() {
    if (this.expiryTimer) {
      clearInterval(this.expiryTimer);
    }
  }

  async createHold(
    input: CreateBookingRequestDto & { driverUserId: string },
  ): Promise<BookingDto> {
    if (!input.spotId?.trim()) {
      throw new BadRequestException('Spot id is required');
    }

    const startAt = this.parseDate(input.startAt, 'startAt');
    const endAt = this.parseDate(input.endAt, 'endAt');

    if (startAt >= endAt) {
      throw new BadRequestException('Start time must be before end time');
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const currency = (input.currency ?? DEFAULT_CURRENCY).trim().toLowerCase();

    if (currency.length !== 3) {
      throw new BadRequestException('Currency must be a 3-letter ISO code');
    }

    await this.expireOverdueHolds();

    const overlap = await this.prisma.booking.findFirst({
      where: {
        spotId: input.spotId,
        status: {
          in: [PrismaBookingStatus.HOLD, PrismaBookingStatus.CONFIRMED],
        },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });

    if (overlap) {
      throw new ConflictException(
        'Spot is already booked for the selected time range',
      );
    }

    const expiresAt = new Date(Date.now() + HOLD_TTL_MINUTES * 60 * 1000);

    let booking: Booking;

    try {
      booking = await this.prisma.booking.create({
        data: {
          spotId: input.spotId,
          driverUserId: input.driverUserId,
          status: PrismaBookingStatus.HOLD,
          amount: input.amount,
          currency,
          startAt,
          endAt,
          expiresAt,
        },
      });
    } catch (error) {
      if (this.isActiveBookingOverlapError(error)) {
        throw new ConflictException(
          'Spot is already booked for the selected time range',
        );
      }

      throw error;
    }

    return this.toBookingDto(booking);
  }

  async listForDriver(driverUserId: string): Promise<BookingDto[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { driverUserId },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((booking) => this.toBookingDto(booking));
  }

  async getForDriver(
    driverUserId: string,
    bookingId: string,
  ): Promise<BookingDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.driverUserId !== driverUserId) {
      throw new ForbiddenException('Booking does not belong to this user');
    }

    return this.toBookingDto(booking);
  }

  async cancelForDriver(
    driverUserId: string,
    bookingId: string,
  ): Promise<BookingDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.driverUserId !== driverUserId) {
      throw new ForbiddenException('Booking does not belong to this user');
    }

    if (
      booking.status === PrismaBookingStatus.CANCELED ||
      booking.status === PrismaBookingStatus.EXPIRED
    ) {
      return this.toBookingDto(booking);
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: PrismaBookingStatus.CANCELED },
    });

    return this.toBookingDto(updated);
  }

  private async expireOverdueHolds(): Promise<void> {
    await this.prisma.booking.updateMany({
      where: {
        status: PrismaBookingStatus.HOLD,
        expiresAt: { lt: new Date() },
      },
      data: { status: PrismaBookingStatus.EXPIRED },
    });
  }

  private toBookingDto(booking: Booking): BookingDto {
    return {
      id: booking.id,
      spotId: booking.spotId,
      driverUserId: booking.driverUserId,
      status: booking.status as BookingStatus,
      amount: booking.amount,
      currency: booking.currency,
      startAt: booking.startAt.toISOString(),
      endAt: booking.endAt.toISOString(),
      expiresAt: booking.expiresAt.toISOString(),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }

  private parseDate(value: string, fieldName: string): Date {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`${fieldName} must be a valid ISO date`);
    }

    return date;
  }

  private isActiveBookingOverlapError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2004'
    );
  }
}
