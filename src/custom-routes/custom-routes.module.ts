// src/custom-routes/custom-routes.module.ts
import { Module } from '@nestjs/common';
import { CustomRoutesService } from './custom-routes.service';
import { CustomRoutesController } from './custom-routes.controller';

@Module({
  controllers: [CustomRoutesController],
  providers: [CustomRoutesService],
  exports: [CustomRoutesService],
})
export class CustomRoutesModule {}