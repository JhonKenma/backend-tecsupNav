// src/ai-assistant/dto/process-command.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessCommandDto {
  @IsNotEmpty({ message: 'El comando es requerido' })
  @IsString({ message: 'El comando debe ser texto' })
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90, { message: 'La latitud debe ser mayor a -90' })
  @Max(90, { message: 'La latitud debe ser menor a 90' })
  currentLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180, { message: 'La longitud debe ser mayor a -180' })
  @Max(180, { message: 'La longitud debe ser menor a 180' })
  currentLng?: number;

  @IsOptional()
  @IsBoolean({ message: 'useAI debe ser un booleano' })
  @Type(() => Boolean)
  useAI?: boolean = true;

  @IsOptional()
  @IsString()
  conversationId?: string;
}