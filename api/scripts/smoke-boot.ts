import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';

async function smokeBoot() {
  const timestamp = new Date().toISOString();
  console.log(`[SMOKE_BOOT] Starting Nest application initialization probe at ${timestamp}...`);
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  await app.init();
  console.log(`[SMOKE_BOOT] [SUCCESS] All modules including GearModule, RentalModule, AppModule initialized cleanly.`);
  await app.close();
  console.log(`[SMOKE_BOOT] Application cleanly closed at ${new Date().toISOString()}.`);
  process.exit(0);
}

smokeBoot().catch((err) => {
  console.error('[SMOKE_BOOT] [FAILED] Application failed to initialize:', err);
  process.exit(1);
});

