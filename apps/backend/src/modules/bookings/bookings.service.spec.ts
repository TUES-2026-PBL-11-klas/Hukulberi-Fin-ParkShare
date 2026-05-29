import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

const baseBooking = {
  id: 'booking-1',
  spotId: '11111111-1111-1111-1111-111111111111',
  spotLabel: 'Central Sofia test spot',
  driverUserId: '22222222-2222-2222-2222-222222222222',
  status: BookingStatus.HOLD,
  amount: 1200,
  currency: 'eur',
  startAt: new Date('2026-05-25T10:00:00.000Z'),
  endAt: new Date('2026-05-25T11:00:00.000Z'),
  expiresAt: new Date('2026-05-25T10:10:00.000Z'),
  createdAt: new Date('2026-05-25T09:50:00.000Z'),
  updatedAt: new Date('2026-05-25T09:50:00.000Z'),
};

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    booking: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      booking: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    service = new BookingsService(prisma as unknown as PrismaService);
  });

  it('expires overdue holds before creating a new hold', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue(baseBooking);

    await service.createHold({
      amount: 1200,
      driverUserId: baseBooking.driverUserId,
      endAt: baseBooking.endAt.toISOString(),
      spotLabel: baseBooking.spotLabel,
      spotId: baseBooking.spotId,
      startAt: baseBooking.startAt.toISOString(),
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: {
        status: BookingStatus.HOLD,
        expiresAt: { lt: expect.any(Date) as Date },
      },
      data: { status: BookingStatus.EXPIRED },
    });
    expect(prisma.booking.create).toHaveBeenCalledWith({
      data: {
        amount: 1200,
        currency: 'eur',
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt,
        expiresAt: expect.any(Date) as Date,
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt,
        status: BookingStatus.HOLD,
      },
    });
  });

  it('reuses an in-flight expiry run when holds are created concurrently', async () => {
    let resolveExpiry: () => void = () => undefined;
    const expiryPromise = new Promise<{ count: number }>((resolve) => {
      resolveExpiry = () => resolve({ count: 0 });
    });

    prisma.booking.updateMany.mockReturnValue(expiryPromise);
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockResolvedValue(baseBooking);

    const firstHold = service.createHold({
      amount: 1200,
      driverUserId: baseBooking.driverUserId,
      endAt: baseBooking.endAt.toISOString(),
      spotLabel: baseBooking.spotLabel,
      spotId: baseBooking.spotId,
      startAt: baseBooking.startAt.toISOString(),
    });
    const secondHold = service.createHold({
      amount: 1200,
      driverUserId: baseBooking.driverUserId,
      endAt: baseBooking.endAt.toISOString(),
      spotLabel: baseBooking.spotLabel,
      spotId: baseBooking.spotId,
      startAt: baseBooking.startAt.toISOString(),
    });

    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);

    resolveExpiry();

    await Promise.all([firstHold, secondHold]);
  });

  it('rejects a hold that overlaps an active booking', async () => {
    prisma.booking.findFirst.mockResolvedValue(baseBooking);

    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt.toISOString(),
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('maps the database overlap constraint to a conflict response', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('exclusion constraint failed', {
        clientVersion: 'test',
        code: 'P2004',
        meta: {
          constraint: 'bookings_no_active_overlap',
        },
      }),
    );

    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt.toISOString(),
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not map unrelated database constraint failures to conflict', async () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'other constraint failed',
      {
        clientVersion: 'test',
        code: 'P2004',
        meta: {
          constraint: 'other_constraint',
        },
      },
    );

    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.create.mockRejectedValue(error);

    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt.toISOString(),
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt.toISOString(),
      }),
    ).rejects.toBe(error);
  });

  it('returns canceled bookings without writing again', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      ...baseBooking,
      status: BookingStatus.CANCELED,
    });

    await expect(
      service.cancelForDriver(baseBooking.driverUserId, baseBooking.id),
    ).resolves.toMatchObject({
      id: baseBooking.id,
      status: BookingStatus.CANCELED,
    });

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('prevents one driver from reading another driver booking', async () => {
    prisma.booking.findUnique.mockResolvedValue(baseBooking);

    await expect(
      service.getForDriver(
        '33333333-3333-3333-3333-333333333333',
        baseBooking.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for missing bookings', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(
      service.cancelForDriver(baseBooking.driverUserId, 'missing-booking'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
