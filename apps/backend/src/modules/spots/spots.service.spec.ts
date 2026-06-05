import { Test, TestingModule } from '@nestjs/testing';
import { SpotsService } from './spots.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SpotsService', () => {
  let service: SpotsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpotsService,
        {
          provide: PrismaService,
          useValue: {
            spot: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SpotsService>(SpotsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSpot', () => {
    it('should create a new spot', async () => {
      const spotData = {
        title: 'Test Spot',
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.006,
        pricePerHour: 1500,
        spaceCount: 3,
        availableDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
        availableFrom: '08:00',
        availableUntil: '20:00',
      };

      const mockSpot = {
        id: '1',
        hostUserId: 'user-1',
        ...spotData,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        hostUser: { id: 'user-1', name: 'Test Host' },
      };

      const createSpot = jest
        .spyOn(prisma.spot, 'create')
        .mockResolvedValue(mockSpot);

      const result = await service.createSpot('user-1', spotData);

      expect(result).toEqual(mockSpot);
      expect(createSpot).toHaveBeenCalledWith({
        data: {
          hostUserId: 'user-1',
          ...spotData,
          photoUrls: [],
          isActive: false,
          verificationStatus: 'PENDING',
        },
        include: {
          hostUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
    });

    it('should reject an invalid availability window', async () => {
      await expect(
        service.createSpot('user-1', {
          title: 'Test Spot',
          address: '123 Main St',
          latitude: 40.7128,
          longitude: -74.006,
          pricePerHour: 1500,
          spaceCount: 2,
          availableDays: ['SAT', 'SUN'],
          availableFrom: '20:00',
          availableUntil: '08:00',
        }),
      ).rejects.toThrow('Available from time must be earlier');
      expect(prisma.spot.create).not.toHaveBeenCalled();
    });
  });

  describe('searchSpots', () => {
    it('should search for active spots', async () => {
      const mockSpots = [
        {
          id: '1',
          title: 'Downtown Spot',
          address: '123 Main St',
          latitude: 40.7128,
          longitude: -74.006,
          pricePerHour: 1500,
          spaceCount: 2,
          availableDays: ['MON', 'TUE', 'WED'],
          availableFrom: '09:00',
          availableUntil: '18:00',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          hostUser: { id: 'user-1', name: 'Host 1' },
          reviews: [],
        },
      ];

      jest.spyOn(prisma.spot, 'findMany').mockResolvedValue(mockSpots);
      jest.spyOn(prisma.spot, 'count').mockResolvedValue(1);

      const result = await service.searchSpots({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should coerce pagination query strings before passing them to Prisma', async () => {
      const findManySpots = jest
        .spyOn(prisma.spot, 'findMany')
        .mockResolvedValue([]);
      jest.spyOn(prisma.spot, 'count').mockResolvedValue(0);

      await service.searchSpots({
        limit: '100' as unknown as number,
        offset: '0' as unknown as number,
      });

      expect(findManySpots).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        }),
      );
    });
  });

  describe('getSpotById', () => {
    it('should return a spot by id', async () => {
      const mockSpot = {
        id: '1',
        title: 'Test Spot',
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.006,
        pricePerHour: 1500,
        spaceCount: 2,
        availableDays: ['MON', 'TUE', 'WED'],
        availableFrom: '09:00',
        availableUntil: '18:00',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        hostUser: { id: 'user-1', name: 'Host 1', email: 'host@example.com' },
        reviews: [],
        bookings: [],
      };

      const findFirstSpot = jest
        .spyOn(prisma.spot, 'findFirst')
        .mockResolvedValue(mockSpot);

      const result = await service.getSpotById('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
      expect(findFirstSpot).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: '1',
            isActive: true,
            verificationStatus: 'VERIFIED',
          },
        }),
      );
    });
  });

  describe('updateSpot', () => {
    it('should reject partial availability updates that create an invalid window', async () => {
      const existingSpot = {
        id: '1',
        hostUserId: 'user-1',
        title: 'Test Spot',
        description: null,
        address: '123 Main St',
        latitude: 40.7128,
        longitude: -74.006,
        pricePerHour: 1500,
        spaceCount: 2,
        availableDays: ['MON', 'TUE', 'WED'],
        availableFrom: '09:00',
        availableUntil: '18:00',
        photoUrls: [],
        verificationStatus: 'VERIFIED',
        verificationNote: null,
        verifiedAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prisma.spot, 'findUnique').mockResolvedValue(existingSpot);

      await expect(
        service.updateSpot('1', 'user-1', {
          availableFrom: '19:00',
        }),
      ).rejects.toThrow('Available from time must be earlier');
      expect(prisma.spot.update).not.toHaveBeenCalled();
    });
  });
});
