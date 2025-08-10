// src/places/dto/create-place.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, Min, Max, IsUrl, IsInt } from 'class-validator';

export class CreatePlaceDto {
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @IsNotEmpty({ message: 'La latitud es requerida' })
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90, { message: 'La latitud debe ser mayor a -90' })
  @Max(90, { message: 'La latitud debe ser menor a 90' })
  latitud: number;

  @IsNotEmpty({ message: 'La longitud es requerida' })
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180, { message: 'La longitud debe ser mayor a -180' })
  @Max(180, { message: 'La longitud debe ser menor a 180' })
  longitud: number;

  @IsNotEmpty({ message: 'El tipo de lugar es requerido' })
  @IsString({ message: 'El tipo de lugar debe ser un texto' })
  tipoId: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;

  @IsOptional()
  @IsUrl({}, { message: 'La imagen debe ser una URL válida' })
  imagen?: string;

  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  isActive?: boolean;

  @IsOptional()
  @IsInt({ message: 'El piso debe ser un número entero' })
  @Min(0, { message: 'El piso debe ser mayor o igual a 0' })
  piso?: number;

  @IsOptional()
  @IsString({ message: 'El edificio debe ser un texto' })
  edificio?: string;

  @IsOptional()
  @IsString({ message: 'El código QR debe ser un texto' })
  codigoQR?: string;
}