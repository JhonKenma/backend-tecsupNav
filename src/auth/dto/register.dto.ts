// src/auth/dto/register.dto.ts
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @Matches(/@tecsup\.edu\.pe$/, { 
    message: 'Solo se permiten correos institucionales (@tecsup.edu.pe)' 
  })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es requerida' })
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString()
  firstName: string;

  @IsNotEmpty({ message: 'El apellido es requerido' })
  @IsString()
  lastName: string;
}