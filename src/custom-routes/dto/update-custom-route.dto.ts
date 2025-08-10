// src/custom-routes/dto/update-custom-route.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomRouteDto } from './create-custom-route.dto';

export class UpdateCustomRouteDto extends PartialType(CreateCustomRouteDto) {}

// Re-exportar para uso público
export { CoordinateDto } from './create-custom-route.dto';