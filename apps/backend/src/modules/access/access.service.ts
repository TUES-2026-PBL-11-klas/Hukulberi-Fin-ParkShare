import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MockAccessProvider } from './access-provider.mock';
import {
  UnlockGateRequestDto,
  UnlockGateResponseDto,
} from '@parkshare/contracts';

// Radius in meters
const GEOFENCE_RADIUS_METERS = 100;

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessProvider: MockAccessProvider,
  ) {}

  async unlockGate(
    bookingId: string,
    userId: string,
    dto: UnlockGateRequestDto,
  ): Promise<UnlockGateResponseDto> {
    this.logger.log(
      `User ${userId} attempting to unlock gate for booking ${bookingId}`,
    );

    // 1. Fetch booking and spot details
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { spot: true },
    });

    if (!booking) {
      await this.logAccessEvent(
        bookingId,
        userId,
        'unknown',
        'FAILED',
        'Booking not found',
      );
      throw new NotFoundException('Booking not found');
    }

    if (booking.driverUserId !== userId) {
      await this.logAccessEvent(
        bookingId,
        userId,
        booking.spot.id,
        'DENIED',
        'User is not the driver for this booking',
      );
      throw new BadRequestException('You do not have access to this booking');
    }

    // Booking must be confirmed to allow access
    if (booking.status !== 'CONFIRMED') {
      await this.logAccessEvent(
        bookingId,
        userId,
        booking.spot.id,
        'DENIED',
        `Booking status is ${booking.status}`,
      );
      throw new BadRequestException('Booking is not confirmed');
    }

    // 2. Validate Geofence (Haversine formula)
    const distance = this.calculateDistanceMeters(
      dto.latitude,
      dto.longitude,
      booking.spot.latitude,
      booking.spot.longitude,
    );

    if (distance > GEOFENCE_RADIUS_METERS) {
      await this.logAccessEvent(
        bookingId,
        userId,
        booking.spot.id,
        'DENIED',
        `User is ${Math.round(distance)}m away (limit: ${GEOFENCE_RADIUS_METERS}m)`,
      );
      throw new BadRequestException(
        `You are too far from the spot. Distance: ${Math.round(distance)}m`,
      );
    }

    // 3. Attempt physical unlock via provider
    const gateId = `gate-${booking.spot.id}`;

    try {
      const success = await this.accessProvider.unlockGate(gateId);

      if (success) {
        await this.logAccessEvent(bookingId, userId, gateId, 'SUCCESS');
        return {
          success: true,
          message: 'Gate unlocked successfully',
          openedAt: new Date().toISOString(),
        };
      }

      await this.logAccessEvent(
        bookingId,
        userId,
        gateId,
        'FAILED',
        'Provider returned false',
      );
      throw new BadRequestException('Failed to unlock gate');
    } catch (error: unknown) {
      const message = this.extractErrorMessage(error);
      this.logger.error(`Error unlocking gate: ${message}`);
      await this.logAccessEvent(bookingId, userId, gateId, 'FAILED', message);
      throw new BadRequestException('Failed to communicate with gate provider');
    }
  }

  private async logAccessEvent(
    bookingId: string,
    userId: string,
    gateId: string,
    status: 'SUCCESS' | 'FAILED' | 'DENIED',
    reason?: string,
  ) {
    try {
      await this.prisma.accessEvent.create({
        data: {
          bookingId,
          userId,
          gateId,
          status,
          reason,
        },
      });
    } catch (error) {
      this.logger.error('Failed to log access event', error);
      // Don't throw here, we don't want audit log failures to break the flow
    }
  }

  private calculateDistanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const p1 = (lat1 * Math.PI) / 180;
    const p2 = (lat2 * Math.PI) / 180;
    const dp = ((lat2 - lat1) * Math.PI) / 180;
    const dl = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dp / 2) * Math.sin(dp / 2) +
      Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'Unknown error';
  }
}
