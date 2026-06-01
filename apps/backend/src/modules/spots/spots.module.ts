import { Module } from '@nestjs/common';
import { SpotsService } from './spots.service';
import { SpotsController } from './spots.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SpotsController],
  providers: [SpotsService],
  exports: [SpotsService],
})
export class SpotsModule {}
