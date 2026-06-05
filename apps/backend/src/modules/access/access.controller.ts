import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { AccessService } from './access.service';
import type {
  UnlockGateRequestDto,
  UnlockGateResponseDto,
} from '@parkshare/contracts';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/bookings')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @UseGuards(JwtAuthGuard)
  @Post(':id/unlock')
  async unlockGate(
    @Param('id') bookingId: string,
    @Body() dto: UnlockGateRequestDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<UnlockGateResponseDto> {
    if (!req.user) {
      throw new UnauthorizedException(
        'Authenticated request is missing user context',
      );
    }

    const userId = req.user.id;
    return this.accessService.unlockGate(bookingId, userId, dto);
  }
}
