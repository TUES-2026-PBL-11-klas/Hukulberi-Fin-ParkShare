import './config/load-env';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import type { Request } from 'express';
import { AppModule } from './app.module';

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bodyParser: false,
  });
  app.use(
    json({
      limit: '8mb',
      verify: (request, _response, buffer) => {
        (request as RawBodyRequest).rawBody = buffer;
      },
    }),
  );
  app.use(urlencoded({ extended: true, limit: '8mb' }));
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
