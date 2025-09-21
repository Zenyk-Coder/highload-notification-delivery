import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

require('dotenv').config({ path: 'apps/notifications-sceduler/.env' });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
