// src/auth/dto/login.dto.ts
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'estudiante@tecsup.edu.pe',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: 'Contraseña del usuario',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString()
  password: string;
}