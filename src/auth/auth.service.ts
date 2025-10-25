// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService { // ✅ Asegurarse que tenga 'export'
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Validar que solo correos @tecsup.edu.pe puedan registrarse como estudiantes
    if (!registerDto.email.endsWith('@tecsup.edu.pe')) {
      throw new BadRequestException('Solo se permiten correos institucionales (@tecsup.edu.pe)');
    }

    const user = await this.usersService.create({
      ...registerDto,
      role: UserRole.STUDENT, // Siempre estudiante para registro manual
    });

    // Remover la contraseña de la respuesta
    const { password, ...userWithoutPassword } = user;
    
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    this.logger.log(`User registered successfully: ${user.email}`);

    return {
      user: userWithoutPassword,
      access_token: this.jwtService.sign(payload),
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.usersService.updateLastLogin(user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const { password, ...userWithoutPassword } = user;

    this.logger.log(`User logged in successfully: ${user.email}`);

    return {
      user: userWithoutPassword,
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive || !user.password) {
      return null;
    }

    const isPasswordValid = await this.usersService.validatePassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async findOrCreateGoogleUser(googleData: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }) {
    // Buscar usuario existente por Google ID
    let user = await this.usersService.findByGoogleId(googleData.googleId);
    
    if (!user) {
      // Buscar por email en caso de que ya tenga cuenta
      user = await this.usersService.findByEmail(googleData.email);
      
      if (!user) {
        // Crear nuevo usuario
        user = await this.usersService.createGoogleUser(googleData);
        this.logger.log(`New Google user created: ${googleData.email}`);
      } else {
        // Actualizar el googleId si el usuario ya existe
        user = await this.usersService.updateGoogleId(user.id, googleData.googleId);
        this.logger.log(`Google ID updated for existing user: ${googleData.email}`);
      }
    }

    return user;
  }

  async googleLogin(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const { password, ...userWithoutPassword } = user;

    this.logger.log(`Google OAuth login successful: ${user.email}`);

    return {
      user: userWithoutPassword,
      access_token: this.jwtService.sign(payload),
    };
  }

  // Verificar token de Google
  async verifyGoogleToken(token: string): Promise<boolean> {
    try {
      this.logger.log('Verificando token de Google...');
      
      // Verificar token con Google usando el endpoint de tokeninfo
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        this.logger.warn(`Token de Google inválido - Status: ${response.status}`);
        return false;
      }
      
      const tokenInfo = await response.json();
      
      // Verificar que el token sea válido y no haya expirado
      const isValid = tokenInfo && 
                     tokenInfo.audience && 
                     tokenInfo.expires_in && 
                     parseInt(tokenInfo.expires_in) > 0;
      
      if (isValid) {
        this.logger.log(`Token de Google válido para: ${tokenInfo.email || 'usuario'}`);
      } else {
        this.logger.warn('Token de Google inválido - Datos incompletos');
      }
      
      return isValid;
    } catch (error) {
      this.logger.error('Error verificando token de Google:', error.message);
      
      // En desarrollo, permitir tokens sin verificación estricta
      if (process.env.NODE_ENV === 'development') {
        this.logger.warn('Modo desarrollo: Permitiendo token sin verificación estricta');
        return true;
      }
      
      return false;
    }
  }

  // Obtener información del usuario desde Google
  async getUserInfoFromGoogle(token: string): Promise<any> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Error obteniendo información del usuario: ${response.status}`);
      }
      
      const userInfo = await response.json();
      this.logger.log(`Información de usuario obtenida: ${userInfo.email}`);
      
      return userInfo;
    } catch (error) {
      this.logger.error('Error obteniendo información del usuario de Google:', error.message);
      throw error;
    }
  }
  
  async getUserProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Remover información sensible
    const { password, ...userProfile } = user;
    
    return userProfile;
  }

}
