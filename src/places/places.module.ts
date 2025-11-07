import { Module } from '@nestjs/common';
import { PlacesService } from './places.service';
import { PlacesController } from './places.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule], // Importar el módulo de storage
  controllers: [PlacesController],
  providers: [PlacesService],
  exports: [PlacesService],
})
export class PlacesModule {}