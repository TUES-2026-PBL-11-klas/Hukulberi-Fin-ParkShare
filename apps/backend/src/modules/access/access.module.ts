import { Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { MockAccessProvider } from './access-provider.mock';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AccessController],
  providers: [AccessService, MockAccessProvider],
})
export class AccessModule {}
