// src/navigation/dto/navigation.dto.ts
import { IsNotEmpty, IsString, IsOptional, IsNumber, IsBoolean, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPlacesDto {
  @IsNotEmpty({ message: 'La búsqueda es requerida' })
  @IsString({ message: 'La búsqueda debe ser un texto' })
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
  @Type(() => Number)
  @IsNumber({}, { message: 'El radio debe ser un número' })
  @Min(1, { message: 'El radio debe ser mayor a 0' })
  @Max(5000, { message: 'El radio debe ser menor a 5000m' })
  radius?: number = 1000;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El límite de resultados debe ser un número' })
  @Min(1, { message: 'Debe solicitar al menos 1 resultado' })
  @Max(50, { message: 'Máximo 50 resultados por búsqueda' })
  maxResults?: number = 10;
}

export class CreateNavigationDto {
  @IsNotEmpty({ message: 'La latitud actual es requerida' })
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90, { message: 'La latitud debe ser mayor a -90' })
  @Max(90, { message: 'La latitud debe ser menor a 90' })
  currentLat: number;

  @IsNotEmpty({ message: 'La longitud actual es requerida' })
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180, { message: 'La longitud debe ser mayor a -180' })
  @Max(180, { message: 'La longitud debe ser menor a 180' })
  currentLng: number;

  @IsNotEmpty({ message: 'El destino es requerido' })
  @IsString({ message: 'El ID del destino debe ser un texto' })
  destinationId: string;

  @IsOptional()
  @IsString({ message: 'El modo debe ser un texto' })
  @IsIn(['walking', 'driving'], { message: 'El modo debe ser walking o driving' })
  mode?: 'walking' | 'driving' = 'walking';

  @IsOptional()
  @IsBoolean({ message: 'Accessible debe ser un booleano' })
  @Type(() => Boolean)
  accessible?: boolean = false;

  @IsOptional()
  @IsBoolean({ message: 'Fastest debe ser un booleano' })
  @Type(() => Boolean)
  fastest?: boolean = true;
}

export class ValidateGPSDto {
  @IsNotEmpty({ message: 'La latitud es requerida' })
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  @Min(-90, { message: 'La latitud debe ser mayor a -90' })
  @Max(90, { message: 'La latitud debe ser menor a 90' })
  lat: number;

  @IsNotEmpty({ message: 'La longitud es requerida' })
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  @Min(-180, { message: 'La longitud debe ser mayor a -180' })
  @Max(180, { message: 'La longitud debe ser menor a 180' })
  lng: number;
}

export class NavigationUpdateDto {
  @IsNotEmpty({ message: 'La latitud actual es requerida' })
  @IsNumber({}, { message: 'La latitud debe ser un número' })
  currentLat: number;

  @IsNotEmpty({ message: 'La longitud actual es requerida' })
  @IsNumber({}, { message: 'La longitud debe ser un número' })
  currentLng: number;

  @IsNotEmpty({ message: 'El destino es requerido' })
  @IsString({ message: 'El ID del destino debe ser un texto' })
  destinationId: string;
}