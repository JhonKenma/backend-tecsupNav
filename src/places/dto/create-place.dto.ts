// src/places/dto/create-place.dto.ts
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean, Min, Max, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlaceDto {
  @ApiProperty({
    example: 'Biblioteca Central',
    description: 'Nombre del lugar',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @ApiProperty({
    example: -12.0464,
    description: 'Latitud del lugar',
    minimum: -90,
    maximum: 90,
  })
  @IsNotEmpty({ message: 'La latitud es requerida' })
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90, { message: 'La latitud debe ser mayor a -90' })
  @Max(90, { message: 'La latitud debe ser menor a 90' })
  latitud: number;

  @ApiProperty({
    example: -77.0428,
    description: 'Longitud del lugar',
    minimum: -180,
    maximum: 180,
  })
  @IsNotEmpty({ message: 'La longitud es requerida' })
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180, { message: 'La longitud debe ser mayor a -180' })
  @Max(180, { message: 'La longitud debe ser menor a 180' })
  longitud: number;

  @ApiProperty({
    example: 'cm123abc456',
    description: 'ID del tipo de lugar',
  })
  @IsNotEmpty({ message: 'El tipo de lugar es requerido' })
  @IsString({ message: 'El tipo de lugar debe ser un texto' })
  tipoId: string;

  @ApiPropertyOptional({
    example: 'Biblioteca principal del campus con más de 10,000 libros',
    description: 'Descripción del lugar',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
    description: 'Imagen del lugar (archivo JPG, PNG, GIF o WebP)',
  })
  @IsOptional()
  @IsString()
  imagen?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Estado activo del lugar',
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive debe ser un booleano' })
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'Número de piso donde se encuentra el lugar',
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'El piso debe ser un número entero' })
  @Min(0, { message: 'El piso debe ser mayor o igual a 0' })
  piso?: number;

  @ApiPropertyOptional({
    example: 'Edificio A',
    description: 'Nombre del edificio',
  })
  @IsOptional()
  @IsString({ message: 'El edificio debe ser un texto' })
  edificio?: string;

  @ApiPropertyOptional({
    example: 'tecsup_biblioteca_central_1234567890_abc123',
    description: 'Código QR único del lugar (se genera automáticamente si no se proporciona)',
  })
  @IsOptional()
  @IsString({ message: 'El código QR debe ser un texto' })
  codigoQR?: string;
}