/* eslint-disable @typescript-eslint/no-unsafe-return,@typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSpotDto, UpdateSpotDto, SearchSpotsDto } from './dto';

/* eslint-disable @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
@Injectable()
export class SpotsService {
  private spotsCreated: Counter;
  private spotsActive: Gauge;
  private searchDuration: Histogram;
  private searchResults: Histogram;

  constructor(private prisma: PrismaService) {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    this.spotsCreated = new Counter({
      name: 'parkshare_marketplace_spots_created_total',
      help: 'Total parking spots created',
      registers: [register],
    });

    this.spotsActive = new Gauge({
      name: 'parkshare_marketplace_spots_active_total',
      help: 'Currently active parking spots',
      registers: [register],
    });

    this.searchDuration = new Histogram({
      name: 'parkshare_marketplace_spots_search_duration_seconds',
      help: 'Spot search query duration in seconds',
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 2],
      registers: [register],
    });

    this.searchResults = new Histogram({
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

    // Build where clause
    const where: any = {
      isActive: true,
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
    if (query.maxPrice !== undefined) {
      where.pricePerHour = { lte: query.maxPrice };
    }

    // Geospatial filter (basic bounding box, not full distance calculation)
    // In production, use PostGIS for proper geospatial queries
    if (
      query.latitude !== undefined &&
      query.longitude !== undefined &&
      query.radiusKm
    ) {
      const radiusDegrees = query.radiusKm / 111.32; // Rough conversion km to degrees
      where.latitude = {
        gte: query.latitude - radiusDegrees,
        lte: query.latitude + radiusDegrees,
      };
      where.longitude = {
        gte: query.longitude - radiusDegrees,
        lte: query.longitude + radiusDegrees,
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
      take: query.limit || 50,
      skip: query.offset || 0,
      orderBy: { createdAt: 'desc' },
    });

    const duration = (Date.now() - startTime) / 1000;
    this.searchDuration.observe(duration);
    this.searchResults.observe(spots.length);

    // Calculate average rating for each spot
    const spotsWithRatings = spots.map((spot) => {
      const ratings = spot.reviews.map((r) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        parseInt(r.rating.replace(/\D/g, ''), 10),
      );
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

  /**
   * Get single spot by ID
   */
  async getSpotById(id: string) {
    const spot = await this.prisma.spot.findUnique({
      where: { id },
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

    // Calculate average rating
    const ratings = spot.reviews.map((r) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      parseInt(r.rating.replace(/\D/g, ''), 10),
    );
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
    const count = await this.prisma.spot.count({ where: { isActive: true } });
    this.spotsActive.set(count);
  }
}
