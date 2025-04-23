import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupFont } from './shared/utils';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}

setupFont().then(bootstrap);
