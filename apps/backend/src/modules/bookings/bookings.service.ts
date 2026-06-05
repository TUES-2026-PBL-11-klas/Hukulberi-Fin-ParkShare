import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  Booking,
  BookingStatus as PrismaBookingStatus,
  Prisma,
  Spot,
  SpotVerificationStatus,
} from '@prisma/client';
import {
  BookingDto,
  BookingStatus,
  CreateBookingRequestDto,
} from '@parkshare/contracts';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_CURRENCY = 'eur';
const HOLD_TTL_MINUTES = 10;
const EXPIRY_POLL_MS = 60_000;
const ACTIVE_BOOKING_OVERLAP_CONSTRAINT = 'bookings_no_active_overlap';
const BOOKING_TIME_ZONE = 'Europe/Sofia';
const weekdayMap: Record<string, string> = {
  Mon: 'MON',
  Tue: 'TUE',
  Wed: 'WED',
  Thu: 'THU',
  Fri: 'FRI',
  Sat: 'SAT',
  Sun: 'SUN',
};

type ZonedDateParts = {
  day: string;
  dateKey: string;
  time: string;
};

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingsService.name);
  private expiryTimer?: NodeJS.Timeout;
  private expiryRun?: Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService = new MetricsService(),
  ) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      void this.expireOverdueHoldsOnce().catch((error: unknown) => {
        this.logger.warn(
          `Could not expire overdue booking holds: ${this.formatError(error)}`,
        );
      });
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

    if (!input.spotLabel?.trim()) {
      throw new BadRequestException('Spot label is required');
    }

    const startAt = this.parseDate(input.startAt, 'startAt');
    const endAt = this.parseDate(input.endAt, 'endAt');

    if (startAt >= endAt) {
      throw new BadRequestException('Start time must be before end time');
    }

    const spot = await this.prisma.spot.findUnique({
      where: { id: input.spotId },
    });

    if (!spot) {
      throw new NotFoundException('Spot not found');
    }

    if (
      !spot.isActive ||
      spot.verificationStatus !== SpotVerificationStatus.VERIFIED
    ) {
      throw new BadRequestException('Spot is not available for reservations');
    }

    this.validateBookingAgainstSpotAvailability(spot, startAt, endAt);

    const expectedAmount = this.calculateBookingAmount(
      spot.pricePerHour,
      startAt,
      endAt,
    );

    if (input.amount !== expectedAmount) {
      throw new BadRequestException(
        'Booking amount does not match the selected time range',
      );
    }

    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }

    const currency = (input.currency ?? DEFAULT_CURRENCY).trim().toLowerCase();

    if (currency.length !== 3) {
      throw new BadRequestException('Currency must be a 3-letter ISO code');
    }

    await this.expireOverdueHoldsOnce();

    const activeDriverBooking = await this.prisma.booking.findFirst({
      where: {
        driverUserId: input.driverUserId,
        status: {
          in: [PrismaBookingStatus.HOLD, PrismaBookingStatus.CONFIRMED],
        },
        endAt: { gt: new Date() },
      },
    });

    if (activeDriverBooking) {
      throw new ConflictException(
        'Cancel or complete your active reservation before creating another one',
      );
    }

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
          spotLabel: input.spotLabel.trim(),
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
      this.metrics.recordBookingCreated(PrismaBookingStatus.HOLD);

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

    this.metrics.recordBookingCanceled();

    return this.toBookingDto(updated);
  }

  private async expireOverdueHolds(): Promise<void> {
    const expired = await this.prisma.booking.updateMany({
      where: {
        status: PrismaBookingStatus.HOLD,
        expiresAt: { lt: new Date() },
      },
      data: { status: PrismaBookingStatus.EXPIRED },
    });

    if (expired?.count > 0) {
      this.metrics.recordBookingExpired(expired.count);
    }
  }

  private expireOverdueHoldsOnce(): Promise<void> {
    if (!this.expiryRun) {
      this.expiryRun = this.expireOverdueHolds().finally(() => {
        this.expiryRun = undefined;
      });
    }

    return this.expiryRun;
  }

  private toBookingDto(booking: Booking): BookingDto {
    return {
      id: booking.id,
      spotId: booking.spotId,
      spotLabel: booking.spotLabel,
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

  private validateBookingAgainstSpotAvailability(
    spot: Spot,
    startAt: Date,
    endAt: Date,
  ) {
    const startParts = this.getZonedDateParts(startAt);
    const endParts = this.getZonedDateParts(endAt);
    const availableDays = this.getAvailableDays(spot.availableDays);

    if (startParts.dateKey !== endParts.dateKey) {
      throw new BadRequestException(
        'Booking must start and end on the same available day',
      );
    }

    if (!availableDays.includes(startParts.day)) {
      throw new BadRequestException(
        'Spot is not available on the selected day',
      );
    }

    if (
      startParts.time < spot.availableFrom ||
      endParts.time > spot.availableUntil
    ) {
      throw new BadRequestException(
        'Spot is not available during the selected hours',
      );
    }
  }

  private calculateBookingAmount(
    pricePerHour: number,
    startAt: Date,
    endAt: Date,
  ): number {
    const durationHours =
      (endAt.getTime() - startAt.getTime()) / (60 * 60 * 1000);

    return Math.round(durationHours * pricePerHour);
  }

  private getAvailableDays(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((day): day is string => typeof day === 'string');
  }

  private getZonedDateParts(date: Date): ZonedDateParts {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone: BOOKING_TIME_ZONE,
      weekday: 'short',
      year: 'numeric',
    }).formatToParts(date);

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value]),
    );
    const weekday = values.weekday ?? '';

    return {
      day: weekdayMap[weekday] ?? weekday.toUpperCase(),
      dateKey: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
    };
  }

  private isActiveBookingOverlapError(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2004'
    ) {
      return false;
    }

    const constraint = error.meta?.constraint;

    if (typeof constraint === 'string') {
      return constraint === ACTIVE_BOOKING_OVERLAP_CONSTRAINT;
    }

    return error.message.includes(ACTIVE_BOOKING_OVERLAP_CONSTRAINT);
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
