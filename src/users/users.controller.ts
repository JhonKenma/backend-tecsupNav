// src/users/users.controller.ts
import { 
  Controller, 
  Get, 
  UseGuards,
  HttpStatus 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // Proteger todas las rutas
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('google-users')
  @Roles(UserRole.ADMIN) // Solo administradores
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los usuarios que se registraron con Google' })
  @ApiResponse({ 
    status: 200, 
    description: 'Lista de usuarios de Google obtenida exitosamente' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Acceso denegado - Solo administradores' 
  })
  async getGoogleUsers(@CurrentUser() currentUser) {
    try {
      const users = await this.usersService.findGoogleUsers();
      
      return {
        success: true,
        message: 'Usuarios de Google obtenidos exitosamente',
        data: {
          count: users.length,
          users: users.map(user => ({
            id: user.id,
            email: user.email,
            nombreCompleto: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: user.avatar,
            role: user.role,
            isActive: user.isActive,
            googleId: user.googleId,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  @Get('google-users/stats')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estadísticas de usuarios de Google' })
  @ApiResponse({ 
    status: 200, 
    description: 'Estadísticas obtenidas exitosamente' 
  })
  async getGoogleUsersStats(@CurrentUser() currentUser) {
    try {
      const stats = await this.usersService.getGoogleUsersStats();
      
      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }

  // OPCIONAL: Endpoint para obtener todos los usuarios (no solo Google)
  @Get('all')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todos los usuarios del sistema' })
  async getAllUsers(@CurrentUser() currentUser) {
    try {
      const users = await this.usersService.findGoogleUsers();
      
      return {
        success: true,
        message: 'Usuarios obtenidos exitosamente',
        data: {
          count: users.length,
          users,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  }
}