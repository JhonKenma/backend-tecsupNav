// src/custom-routes/dto/create-custom-route.dto.ts
import { 
  IsNotEmpty, 
  IsString, 
  IsOptional, 
  IsArray, 
  IsNumber, 
  IsBoolean, 
  IsIn,
  ValidateNested,
  ArrayMinSize,
  Min 
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoordinateDto {
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  lat: number;

  @IsNumber({}, { message: 'La longitud debe ser un número' })
  lng: number;
}

export class CreateCustomRouteDto {
  @IsNotEmpty({ message: 'El origen es requerido' })
  @IsString({ message: 'El origen debe ser un ID válido' })
  origenId: string;

  @IsNotEmpty({ message: 'El destino es requerido' })
  @IsString({ message: 'El destino debe ser un ID válido' })
  destinoId: string;

  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre?: string;

  @IsOptional()
  @IsArray({ message: 'Los puntos deben ser un array' })
  @ArrayMinSize(2, { message: 'Se requieren al menos 2 puntos para crear una ruta' })
  @ValidateNested({ each: true })
  @Type(() => CoordinateDto)
  puntos?: CoordinateDto[];

  @IsOptional()
  @IsNumber({}, { message: 'El tiempo estimado debe ser un número' })
  @Min(1, { message: 'El tiempo estimado debe ser mayor a 0' })
  tiempoEstimado?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La distancia debe ser un número' })
  @Min(0, { message: 'La distancia debe ser mayor o igual a 0' })
  distancia?: number;

  @IsOptional()
  @IsString({ message: 'La dificultad debe ser un texto' })
  @IsIn(['facil', 'medio', 'dificil'], { message: 'La dificultad debe ser: facil, medio o dificil' })
  dificultad?: string;

  @IsOptional()
  @IsBoolean({ message: 'Accesible debe ser un booleano' })
  accesible?: boolean;

  @IsOptional()
  @IsString({ message: 'Las notas deben ser un texto' })
  notas?: string;

  // Flag para indicar si se debe calcular automáticamente la ruta
  @IsOptional()
  @IsBoolean({ message: 'autoCalculate debe ser un booleano' })
  autoCalculate?: boolean = true;
}