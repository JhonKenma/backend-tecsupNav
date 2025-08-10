// src/place-types/dto/create-place-type.dto.ts
import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';

export class CreatePlaceTypeDto {
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;

  @IsOptional()
  @IsString({ message: 'El icono debe ser un texto' })
  icono?: string;

  @IsOptional()
  @IsString({ message: 'El color debe ser un texto' })
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'El color debe ser un código hex válido (ej: #FF0000)' })
  color?: string;
}