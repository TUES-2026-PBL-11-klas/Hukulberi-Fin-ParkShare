import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { BookingDto, CreateBookingRequestDto } from '@parkshare/contracts';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

@Controller('api/v1/bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createBooking(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateBookingRequestDto,
  ): Promise<BookingDto> {
    if (!request.user) {
      throw new UnauthorizedException(
        'Authenticated request is missing user context',
      );
    }

    return this.bookingsService.createHold({
      ...body,
      driverUserId: request.user.id,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  listBookings(@Req() request: AuthenticatedRequest): Promise<BookingDto[]> {
    if (!request.user) {
      throw new UnauthorizedException(
        'Authenticated request is missing user context',
      );
    }

    return this.bookingsService.listForDriver(request.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getBooking(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<BookingDto> {
    if (!request.user) {
      throw new UnauthorizedException(
        'Authenticated request is missing user context',
      );
    }

    return this.bookingsService.getForDriver(request.user.id, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelBooking(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<BookingDto> {
    if (!request.user) {
      throw new UnauthorizedException(
        'Authenticated request is missing user context',
      );
    }

    return this.bookingsService.cancelForDriver(request.user.id, id);
  }
}
