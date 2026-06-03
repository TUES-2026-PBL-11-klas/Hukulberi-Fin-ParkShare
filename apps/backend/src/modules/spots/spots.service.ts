/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';
import { ReviewRating, SpotVerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateSpotDto,
  UpdateSpotDto,
  SearchSpotsDto,
  UpdateSpotVerificationDto,
} from './dto';

@Injectable()
export class SpotsService {
  private readonly logger = new Logger(SpotsService.name);
  private spotsCreated: Counter;
  private spotsActive: Gauge;
  private searchDuration: Histogram;
  private searchResults: Histogram;

  constructor(private prisma: PrismaService) {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.spotsCreated = this.getOrCreateCounter({
      name: 'parkshare_marketplace_spots_created_total',
      help: 'Total parking spots created',
      registers: [register],
    });

    this.spotsActive = this.getOrCreateGauge({
      name: 'parkshare_marketplace_spots_active_total',
      help: 'Currently active parking spots',
      registers: [register],
    });

    this.searchDuration = this.getOrCreateHistogram({
      name: 'parkshare_marketplace_spots_search_duration_seconds',
      help: 'Spot search query duration in seconds',
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [register],
    });

    this.searchResults = this.getOrCreateHistogram({
      name: 'parkshare_marketplace_spots_search_results_count',
      help: 'Number of spots returned from search',
      buckets: [1, 5, 10, 25, 50, 100, 250, 500],
      registers: [register],
    });

    // Initialize active spots gauge
    void this.updateActiveSpots();
  }

  /**
   * Create a new parking spot
   */
  async createSpot(hostUserId: string, createSpotDto: CreateSpotDto) {
    const spot = await this.prisma.spot.create({
      data: {
        hostUserId,
        ...createSpotDto,
        photoUrls: createSpotDto.photoUrls ?? [],
        isActive: false,
        verificationStatus: SpotVerificationStatus.PENDING,
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

    this.spotsCreated.inc();
    void this.updateActiveSpots();

    return spot;
  }

  /**
   * Search for active spots with optional filtering
   */
  async searchSpots(query: SearchSpotsDto) {
    const startTime = Date.now();
    const latitude = this.toFiniteNumber(query.latitude);
    const longitude = this.toFiniteNumber(query.longitude);
    const radiusKm = this.toFiniteNumber(query.radiusKm);
    const maxPrice = this.toFiniteNumber(query.maxPrice);
    const limit = Math.min(
      Math.max(Math.trunc(this.toFiniteNumber(query.limit) ?? 50), 1),
      100,
    );
    const offset = Math.max(
      Math.trunc(this.toFiniteNumber(query.offset) ?? 0),
      0,
    );

    // Build where clause
    const where: any = {
      isActive: true,
      verificationStatus: SpotVerificationStatus.VERIFIED,
    };

    // Text search on title/description/address
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Price filter
    if (maxPrice !== undefined) {
      where.pricePerHour = { lte: maxPrice };
    }

    // Geospatial filter (basic bounding box, not full distance calculation)
    // In production, use PostGIS for proper geospatial queries
    if (
      latitude !== undefined &&
      longitude !== undefined &&
      radiusKm !== undefined
    ) {
      const radiusDegrees = radiusKm / 111.32; // Rough conversion km to degrees
      where.latitude = {
        gte: latitude - radiusDegrees,
        lte: latitude + radiusDegrees,
      };
      where.longitude = {
        gte: longitude - radiusDegrees,
        lte: longitude + radiusDegrees,
      };
    }

    // Execute query with pagination
    const spots = await this.prisma.spot.findMany({
      where,
      include: {
        hostUser: {
          select: {
            id: true,
            name: true,
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const duration = (Date.now() - startTime) / 1000;
    this.searchDuration.observe(duration);
    this.searchResults.observe(spots.length);

    // Calculate average rating for each spot
    const ratingMap: Record<ReviewRating, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };

    const spotsWithRatings = spots.map((spot) => {
      const ratings = spot.reviews.map((r) => ratingMap[r.rating]);
      const avgRating =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b) / ratings.length
          : 0;
      return {
        ...spot,
        averageRating: parseFloat(avgRating.toFixed(2)),
        reviewCount: spot.reviews.length,
        reviews: undefined, // Remove detailed reviews
      };
    });

    return {
      data: spotsWithRatings,
      total: await this.prisma.spot.count({ where }),
    };
  }

  private toFiniteNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const numberValue = typeof value === 'number' ? value : Number(value);

    return Number.isFinite(numberValue) ? numberValue : undefined;
  }

  /**
   * Get single spot by ID
   */
  async getSpotById(id: string) {
    const spot = await this.prisma.spot.findFirst({
      where: {
        id,
        isActive: true,
        verificationStatus: SpotVerificationStatus.VERIFIED,
      },
      include: {
        hostUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        reviews: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        bookings: {
          where: { status: 'CONFIRMED' },
          select: {
            id: true,
            startAt: true,
            endAt: true,
          },
        },
      },
    });

    if (!spot) {
      throw new NotFoundException(`Spot with ID ${id} not found`);
    }

    const ratingMap: Record<ReviewRating, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };

    // Calculate average rating
    const ratings = spot.reviews.map((r) => ratingMap[r.rating]);
    const avgRating =
      ratings.length > 0 ? ratings.reduce((a, b) => a + b) / ratings.length : 0;

    return {
      ...spot,
      averageRating: parseFloat(avgRating.toFixed(2)),
      reviewCount: spot.reviews.length,
    };
  }

  /**
   * Update spot (owner only)
   */
  async updateSpot(
    id: string,
    hostUserId: string,
    updateSpotDto: UpdateSpotDto,
  ) {
    const spot = await this.prisma.spot.findUnique({ where: { id } });

    if (!spot) {
      throw new NotFoundException(`Spot with ID ${id} not found`);
    }

    if (spot.hostUserId !== hostUserId) {
      throw new ForbiddenException('You can only edit your own spots');
    }

    const updated = await this.prisma.spot.update({
      where: { id },
      data: updateSpotDto,
      include: {
        hostUser: {
          select: { id: true, name: true },
        },
      },
    });

    void this.updateActiveSpots();

    return updated;
  }

  async updateSpotVerification(
    id: string,
    updateSpotVerificationDto: UpdateSpotVerificationDto,
  ) {
    const spot = await this.prisma.spot.findUnique({ where: { id } });

    if (!spot) {
      throw new NotFoundException(`Spot with ID ${id} not found`);
    }

    const updated = await this.prisma.spot.update({
      where: { id },
      data: {
        verificationStatus: updateSpotVerificationDto.status,
        verificationNote: updateSpotVerificationDto.note,
        verifiedAt:
          updateSpotVerificationDto.status === SpotVerificationStatus.VERIFIED
            ? new Date()
            : null,
        isActive:
          updateSpotVerificationDto.status === SpotVerificationStatus.VERIFIED,
      },
      include: {
        hostUser: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    void this.updateActiveSpots();

    return updated;
  }

  /**
   * Delete spot (owner only)
   */
  async deleteSpot(id: string, hostUserId: string) {
    const spot = await this.prisma.spot.findUnique({ where: { id } });

    if (!spot) {
      throw new NotFoundException(`Spot with ID ${id} not found`);
    }

    if (spot.hostUserId !== hostUserId) {
      throw new ForbiddenException('You can only delete your own spots');
    }

    await this.prisma.spot.delete({ where: { id } });
    void this.updateActiveSpots();

    return { message: 'Spot deleted successfully' };
  }

  /**
   * Get all spots by a specific host
   */
  async getSpotsByHost(hostUserId: string) {
    return this.prisma.spot.findMany({
      where: { hostUserId },
      include: {
        reviews: {
          select: { id: true, rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update active spots gauge
   */
  private async updateActiveSpots() {
    try {
      const count = await this.prisma.spot.count({
        where: {
          isActive: true,
          verificationStatus: SpotVerificationStatus.VERIFIED,
        },
      });

      if (Number.isFinite(count)) {
        this.spotsActive.set(count);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to update active spots metric: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private getOrCreateCounter(config: ConstructorParameters<typeof Counter>[0]) {
    const existing = register.getSingleMetric(config.name);
    return existing instanceof Counter ? existing : new Counter(config);
  }

  private getOrCreateGauge(config: ConstructorParameters<typeof Gauge>[0]) {
    const existing = register.getSingleMetric(config.name);
    return existing instanceof Gauge ? existing : new Gauge(config);
  }

  private getOrCreateHistogram(
    config: ConstructorParameters<typeof Histogram>[0],
  ) {
    const existing = register.getSingleMetric(config.name);
    return existing instanceof Histogram ? existing : new Histogram(config);
  }
}
