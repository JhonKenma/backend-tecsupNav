// src/place-types/dto/create-place-type.dto.ts
import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePlaceTypeDto {
  @ApiProperty({
    example: 'Biblioteca',
    description: 'Nombre del tipo de lugar',
  })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @ApiPropertyOptional({
    example: 'Espacios de lectura y estudio',
    description: 'Descripción del tipo de lugar',
  })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;

  @ApiPropertyOptional({
    example: 'book',
    description: 'Nombre del icono para mostrar en el mapa',
  })
  @IsOptional()
  @IsString({ message: 'El icono debe ser un texto' })
  icono?: string;

  @ApiPropertyOptional({
    example: '#FF5733',
    description: 'Color hexadecimal para el marcador',
    pattern: '^#[0-9A-Fa-f]{6}$',
  })
  @IsOptional()
  @IsString({ message: 'El color debe ser un texto' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un código hex válido (ej: #FF0000)' })
  color?: string;
}