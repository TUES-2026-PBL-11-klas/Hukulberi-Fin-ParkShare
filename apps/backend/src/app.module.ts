import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { SpotsModule } from './modules/spots/spots.module';
import { ReviewsModule } from './modules/reviews/reviews.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BookingsModule,
    PaymentsModule,
    SpotsModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
