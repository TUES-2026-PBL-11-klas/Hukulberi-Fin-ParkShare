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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/v1/spots')
export class SpotsController {
  constructor(private readonly spotsService: SpotsService) {}

  /**
   * Admin-only: List all spots for moderation
   */
  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminList(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.spotsService.adminListSpots(
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async verify(
    @Param('id') id: string,
    @Body() updateSpotVerificationDto: UpdateSpotVerificationDto,
  ) {
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
  getByHost(@Param('hostUserId') hostUserId: string) {
    return this.spotsService.getSpotsByHost(hostUserId);
  }
}
