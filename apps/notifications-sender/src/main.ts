import { NestFactory } from '@nestjs/core';
import { AppModule } from 'apps/notifications-sender/src/app.module';

require('dotenv').config({ path: 'apps/push-sender/.env' });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
