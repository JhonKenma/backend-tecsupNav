// src/auth/auth.controller.ts
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get, 
  Req, 
  Res,
  HttpStatus,
  ValidationPipe
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MobileOnlyGuard, WebOnlyGuard } from '../common/guards/platform.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body(ValidationPipe) registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);
      return {
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }
  }

  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body(ValidationPipe) loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);
      return {
        success: true,
        message: 'Login exitoso',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.UNAUTHORIZED,
      };
    }
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // El guard redirigirá a Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    try {
      const result = await this.authService.googleLogin(req.user);
      
      if (req.user.role === UserRole.ADMIN) {
        res.redirect(`${process.env.WEB_URL}/dashboard?token=${result.access_token}`);
      } else {
        res.redirect(`${process.env.MOBILE_DEEP_LINK}://auth?token=${result.access_token}`);
      }
    } catch (error) {
      res.redirect(`${process.env.WEB_URL}/auth/error`);
    }
  }

  // NUEVO: Endpoint para autenticación móvil con Google
  @Post('google/mobile')
  async googleMobileAuth(@Body() googleData: {
    googleToken: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }) {
    try {
      // Verificar que el email sea institucional
      if (!googleData.email.endsWith('@tecsup.edu.pe')) {
        return {
          success: false,
          message: 'Solo se permiten correos institucionales (@tecsup.edu.pe)',
          statusCode: HttpStatus.BAD_REQUEST,
        };
      }

      // Verificar el token con Google (opcional - para mayor seguridad)
      const isValidToken = await this.authService.verifyGoogleToken(googleData.googleToken);
      if (!isValidToken) {
        return {
          success: false,
          message: 'Token de Google inválido',
          statusCode: HttpStatus.UNAUTHORIZED,
        };
      }
 
      // Buscar o crear usuario con los datos de Google
      const user = await this.authService.findOrCreateGoogleUser({
        googleId: `google_${googleData.email}`, // Crear un ID único basado en email
        email: googleData.email,
        firstName: googleData.firstName,
        lastName: googleData.lastName,
        avatar: googleData.avatar,
      });

      // Crear JWT token para nuestra app
      const result = await this.authService.googleLogin(user);

      return {
        success: true,
        message: 'Autenticación con Google exitosa',
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user) {
    try {
      // Obtener información completa del usuario desde el objeto provisto por el decorator
      const userProfile = user;
      
      return {
        success: true,
        message: 'Perfil obtenido exitosamente',
        data: {
          id: userProfile.id,
          email: userProfile.email,
          nombreCompleto: `${userProfile.firstName} ${userProfile.lastName}`,
          firstName: userProfile.firstName,
          lastName: userProfile.lastName,
          avatar: userProfile.avatar || null, // Imagen de perfil
          role: userProfile.role,
          createdAt: userProfile.createdAt,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.NOT_FOUND,
      };
    }
  }

  @Get('mobile/dashboard')
  @UseGuards(JwtAuthGuard, MobileOnlyGuard)
  @Roles(UserRole.STUDENT)
  async getMobileDashboard(@CurrentUser() user) {
    return {
      success: true,
      message: 'Bienvenido a la app móvil',
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        permissions: ['navigation', 'voice_assistant', 'location_search'],
      },
    };
  }

  @Get('web/dashboard')
  @UseGuards(JwtAuthGuard, WebOnlyGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getWebDashboard(@CurrentUser() user) {
    return {
      success: true,
      message: 'Bienvenido al panel administrativo',
      data: {
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
        permissions: ['user_management', 'map_management', 'analytics'],
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout() {
    return {
      success: true,
      message: 'Logout exitoso',
    };
  }

  @Get('verify')
  @UseGuards(JwtAuthGuard)
  async verifyToken(@CurrentUser() user) {
    return {
      success: true,
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }
}
