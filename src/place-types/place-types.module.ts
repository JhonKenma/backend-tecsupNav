// src/place-types/place-types.module.ts
import { Module } from '@nestjs/common';
import { PlaceTypesService } from './place-types.service';
import { PlaceTypesController } from './place-types.controller';

@Module({
  controllers: [PlaceTypesController],
  providers: [PlaceTypesService],
  exports: [PlaceTypesService],
})
export class PlaceTypesModule {}