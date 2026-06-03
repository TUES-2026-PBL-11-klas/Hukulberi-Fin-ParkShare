import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
  Patch,
  ForbiddenException,
} from '@nestjs/common';
import { SpotsService } from './spots.service';
import {
  CreateSpotDto,
  UpdateSpotDto,
  SearchSpotsDto,
  UpdateSpotVerificationDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('api/v1/spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  /**
   * Create a new parking spot (HOST only)
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createSpotDto: CreateSpotDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.spotsService.createSpot(user.id, createSpotDto);
  }

  /**
   * Get all active spots with optional filtering/search
   */
  @Get()
  async search(@Query() query: SearchSpotsDto) {
    return this.spotsService.searchSpots(query);
  }

  /**
   * Get single spot by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.spotsService.getSpotById(id);
  }

  /**
   * Update spot (HOST/ADMIN only)
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateSpotDto: UpdateSpotDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.spotsService.updateSpot(id, user.id, updateSpotDto);
  }

  @Patch(':id/verification')
  @UseGuards(JwtAuthGuard)
  async verify(
    @Param('id') id: string,
    @Body() updateSpotVerificationDto: UpdateSpotVerificationDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can verify spots');
    }

    return this.spotsService.updateSpotVerification(
      id,
      updateSpotVerificationDto,
    );
  }

  /**
   * Delete spot (HOST/ADMIN only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.spotsService.deleteSpot(id, user.id);
  }

  /**
   * Get spots by host user
   */
  @Get('host/:hostUserId')
  async getByHost(@Param('hostUserId') hostUserId: string) {
    return this.spotsService.getSpotsByHost(hostUserId);
  }
}
