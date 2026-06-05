import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma, SpotVerificationStatus } from '@prisma/client';
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

const baseSpot = {
  id: baseBooking.spotId,
  hostUserId: '33333333-3333-3333-3333-333333333333',
  title: baseBooking.spotLabel,
  description: null,
  address: 'Address X, Sofia',
  latitude: 42.6977,
  longitude: 23.3219,
  pricePerHour: 1200,
  spaceCount: 1,
  availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  availableFrom: '08:00',
  availableUntil: '20:00',
  photoUrls: [],
  verificationStatus: SpotVerificationStatus.VERIFIED,
  verificationNote: null,
  verifiedAt: new Date('2026-05-01T10:00:00.000Z'),
  isActive: true,
  createdAt: new Date('2026-05-01T10:00:00.000Z'),
  updatedAt: new Date('2026-05-01T10:00:00.000Z'),
};

describe('BookingsService', () => {
  let service: BookingsService;
  let prisma: {
    $transaction: jest.Mock;
    booking: {
      count: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    spot: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        callback(prisma),
      ),
      booking: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      spot: {
        findUnique: jest.fn(),
      },
    };
    prisma.spot.findUnique.mockResolvedValue(baseSpot);
    prisma.booking.count.mockResolvedValue(0);

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

    await Promise.resolve();

    expect(prisma.booking.updateMany).toHaveBeenCalledTimes(1);

    resolveExpiry();

    await Promise.all([firstHold, secondHold]);
  });

  it('allows overlapping bookings while the spot still has free spaces', async () => {
    prisma.spot.findUnique.mockResolvedValue({
      ...baseSpot,
      spaceCount: 2,
    });
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.count.mockResolvedValue(1);
    prisma.booking.create.mockResolvedValue(baseBooking);

    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt.toISOString(),
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt.toISOString(),
      }),
    ).resolves.toMatchObject({ id: baseBooking.id });

    expect(prisma.booking.count).toHaveBeenCalledWith({
      where: {
        spotId: baseBooking.spotId,
        status: {
          in: [BookingStatus.HOLD, BookingStatus.CONFIRMED],
        },
        startAt: { lt: baseBooking.endAt },
        endAt: { gt: baseBooking.startAt },
      },
    });
    expect(prisma.booking.create).toHaveBeenCalled();
  });

  it('rejects a hold when every spot space is already reserved', async () => {
    prisma.spot.findUnique.mockResolvedValue({
      ...baseSpot,
      spaceCount: 2,
    });
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.count.mockResolvedValue(2);

    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt.toISOString(),
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt.toISOString(),
      }),
    ).rejects.toThrow('No spaces are available for the selected time range');

    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a hold when the driver already has an active reservation', async () => {
    prisma.booking.findFirst.mockResolvedValueOnce({
      ...baseBooking,
      spotId: '44444444-4444-4444-4444-444444444444',
      endAt: new Date('2026-05-26T11:00:00.000Z'),
    });

    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt.toISOString(),
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt.toISOString(),
      }),
    ).rejects.toThrow(
      'Cancel or complete your active reservation before creating another one',
    );

    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a hold on a day outside the spot availability', async () => {
    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: '2026-05-30T11:00:00.000Z',
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: '2026-05-30T10:00:00.000Z',
      }),
    ).rejects.toThrow('Spot is not available on the selected day');

    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a hold outside the spot availability hours', async () => {
    await expect(
      service.createHold({
        amount: 1200,
        driverUserId: baseBooking.driverUserId,
        endAt: '2026-05-25T04:00:00.000Z',
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: '2026-05-25T03:00:00.000Z',
      }),
    ).rejects.toThrow('Spot is not available during the selected hours');

    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a client supplied amount that does not match the spot price', async () => {
    await expect(
      service.createHold({
        amount: 100,
        driverUserId: baseBooking.driverUserId,
        endAt: baseBooking.endAt.toISOString(),
        spotLabel: baseBooking.spotLabel,
        spotId: baseBooking.spotId,
        startAt: baseBooking.startAt.toISOString(),
      }),
    ).rejects.toThrow('Booking amount does not match');

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
