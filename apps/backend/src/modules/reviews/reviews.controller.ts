import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/v1/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /**
   * Create review for a booking (DRIVER only, one per booking)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.reviewsService.createReview(user.id, createReviewDto);
  }

  /**
   * Get review for a specific booking
   */
  @Get('booking/:bookingId')
  async getByBooking(@Param('bookingId') bookingId: string) {
    return this.reviewsService.getReviewByBooking(bookingId);
  }

  /**
   * Get all reviews for a spot (public)
   */
  @Get('spot/:spotId')
  async getBySpot(
    @Param('spotId') spotId: string,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '0',
  ) {
    return this.reviewsService.getReviewsBySpot(
      spotId,
      parseInt(limit),
      parseInt(offset),
    );
  }

  /**
   * Get reviews written by a user
   */
  @Get('author/:authorId')
  async getByAuthor(
    @Param('authorId') authorId: string,
    @Query('limit') limit: string = '10',
  ) {
    return this.reviewsService.getReviewsByAuthor(authorId, parseInt(limit));
  }

  /**
   * Get review statistics for a spot
   */
  @Get('stats/spot/:spotId')
  async getSpotStats(@Param('spotId') spotId: string) {
    return this.reviewsService.getSpotReviewStats(spotId);
  }
}
