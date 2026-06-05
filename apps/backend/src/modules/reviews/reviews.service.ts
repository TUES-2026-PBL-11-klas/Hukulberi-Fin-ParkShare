import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Counter, register } from 'prom-client';
import { ReviewRating } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  private reviewsCreated: Counter;

  constructor(private prisma: PrismaService) {
    this.initializeMetrics();
  }

  private initializeMetrics() {
    const existingMetric = register.getSingleMetric('parkshare_marketplace_reviews_created_total');
    if (existingMetric) {
      this.reviewsCreated = existingMetric as Counter;
    } else {
      this.reviewsCreated = new Counter({
        name: 'parkshare_marketplace_reviews_created_total',
        help: 'Total reviews written',
        registers: [register],
      });
    }
  }

  /**
   * Create review for a booking
   * Constraints:
   * - One review per booking (enforced by unique constraint)
   * - Only driver who completed booking can review
   * - Booking must be CONFIRMED
   */
  async createReview(authorId: string, createReviewDto: CreateReviewDto) {
    const { bookingId, spotId, rating, comment } = createReviewDto;

    // Verify booking exists and belongs to the author
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { driverUser: true },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    if (booking.driverUserId !== authorId) {
      throw new BadRequestException(
        'You can only review bookings you completed',
      );
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('You can only review completed bookings');
    }

    // Verify spot exists and matches booking
    if (booking.spotId !== spotId) {
      throw new BadRequestException('Spot ID does not match booking');
    }

    // Check if review already exists for this booking (one per booking rule)
    const existingReview = await this.prisma.review.findUnique({
      where: { bookingId },
    });

    if (existingReview) {
      throw new ConflictException('A review already exists for this booking');
    }

    // Create review
    const review = await this.prisma.review.create({
      data: {
        bookingId,
        spotId,
        authorId,
        rating,
        comment,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    this.reviewsCreated.inc();

    return review;
  }

  /**
   * Get review for a specific booking
   */
  async getReviewByBooking(bookingId: string) {
    const review = await this.prisma.review.findUnique({
      where: { bookingId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(`No review found for booking ${bookingId}`);
    }

    return review;
  }

  /**
   * Get all reviews for a spot (paginated, most recent first)
   */
  async getReviewsBySpot(
    spotId: string,
    limit: number = 10,
    offset: number = 0,
  ) {
    // Verify spot exists
    const spot = await this.prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) {
      throw new NotFoundException(`Spot with ID ${spotId} not found`);
    }

    const reviews = await this.prisma.review.findMany({
      where: { spotId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.review.count({ where: { spotId } });

    return {
      data: reviews,
      total,
      limit,
      offset,
    };
  }

  /**
   * Get reviews written by a specific user
   */
  async getReviewsByAuthor(authorId: string, limit: number = 10) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id: authorId } });
    if (!user) {
      throw new NotFoundException(`User with ID ${authorId} not found`);
    }

    return this.prisma.review.findMany({
      where: { authorId },
      include: {
        spot: {
          select: {
            id: true,
            title: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get review statistics for a spot
   */
  async getSpotReviewStats(spotId: string) {
    // Verify spot exists
    const spot = await this.prisma.spot.findUnique({ where: { id: spotId } });
    if (!spot) {
      throw new NotFoundException(`Spot with ID ${spotId} not found`);
    }

    const reviews = await this.prisma.review.findMany({
      where: { spotId },
      select: { rating: true },
    });

    // Convert ratings to numbers (ONE=1, TWO=2, etc.)
    const ratingMap: Record<ReviewRating, number> = {
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
    };

    const ratingNumbers = reviews.map((r) => ratingMap[r.rating]);

    if (ratingNumbers.length === 0) {
      return {
        spotId,
        totalReviews: 0,
        averageRating: 0,
        distribution: {
          ONE: 0,
          TWO: 0,
          THREE: 0,
          FOUR: 0,
          FIVE: 0,
        },
      };
    }

    const average =
      ratingNumbers.reduce((a, b) => a + b) / ratingNumbers.length;

    // Count distribution
    const distribution = {
      ONE: reviews.filter((r) => r.rating === ReviewRating.ONE).length,
      TWO: reviews.filter((r) => r.rating === ReviewRating.TWO).length,
      THREE: reviews.filter((r) => r.rating === ReviewRating.THREE).length,
      FOUR: reviews.filter((r) => r.rating === ReviewRating.FOUR).length,
      FIVE: reviews.filter((r) => r.rating === ReviewRating.FIVE).length,
    };

    return {
      spotId,
      totalReviews: reviews.length,
      averageRating: parseFloat(average.toFixed(2)),
      distribution,
    };
  }
}
