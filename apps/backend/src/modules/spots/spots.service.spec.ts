/* eslint-disable @typescript-eslint/unbound-method */
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
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
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
      };

      const mockSpot = {
        id: '1',
        hostUserId: 'user-1',
        ...spotData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        hostUser: { id: 'user-1', name: 'Test Host' },
      };

      jest.spyOn(prisma.spot, 'create').mockResolvedValue(mockSpot);

      const result = await service.createSpot('user-1', spotData);

      expect(result).toEqual(mockSpot);
      expect(prisma.spot.create).toHaveBeenCalledWith({
        data: {
          hostUserId: 'user-1',
          ...spotData,
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
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        hostUser: { id: 'user-1', name: 'Host 1', email: 'host@example.com' },
        reviews: [],
        bookings: [],
      };

      jest.spyOn(prisma.spot, 'findUnique').mockResolvedValue(mockSpot);

      const result = await service.getSpotById('1');

      expect(result).toBeDefined();
      expect(result.id).toBe('1');
    });
  });
});
