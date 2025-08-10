// src/custom-routes/dto/search-routes.dto.ts
import { IsOptional, IsString, IsNumber, IsBoolean, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchRoutesDto {
  @IsOptional()
  @IsString()
  origenId?: string;

  @IsOptional()
  @IsString()
  destinoId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['facil', 'medio', 'dificil'])
  dificultad?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  accesible?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxTiempo?: number; // Tiempo máximo en minutos

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxDistancia?: number; // Distancia máxima en metros

  // Paginación
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}