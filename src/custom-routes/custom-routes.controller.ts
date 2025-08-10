// src/custom-routes/custom-routes.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { CustomRoutesService } from './custom-routes.service';
import { CreateCustomRouteDto } from './dto/create-custom-route.dto';
import { UpdateCustomRouteDto } from './dto/update-custom-route.dto';
import { SearchRoutesDto } from './dto/search-routes.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('custom-routes')
@UseGuards(JwtAuthGuard)
export class CustomRoutesController {
  constructor(private readonly customRoutesService: CustomRoutesService) {}

  // Solo administradores pueden crear rutas personalizadas
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body(ValidationPipe) createCustomRouteDto: CreateCustomRouteDto) {
    try {
      const route = await this.customRoutesService.create(createCustomRouteDto);
      return {
        success: true,
        message: 'Ruta personalizada creada exitosamente',
        data: route,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // Todos los usuarios autenticados pueden ver rutas
  @Get()
  async findAll(@Query() searchDto: SearchRoutesDto) {
    try {
      const result = await this.customRoutesService.findAll(searchDto);
      return {
        success: true,
        data: result.routes,
        pagination: result.pagination,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Estadísticas solo para administradores
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async getStats() {
    try {
      const stats = await this.customRoutesService.getStats();
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Encontrar la ruta más rápida entre dos lugares (útil para navegación)
  @Get('fastest')
  async findFastestRoute(
    @Query('origen') origenId: string,
    @Query('destino') destinoId: string,
  ) {
    try {
      if (!origenId || !destinoId) {
        return {
          success: false,
          message: 'Se requieren los parámetros origen y destino',
          statusCode: HttpStatus.BAD_REQUEST,
        };
      }

      const route = await this.customRoutesService.findFastestRoute(origenId, destinoId);
      return {
        success: true,
        data: route,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.NOT_FOUND,
      };
    }
  }

  // Rutas desde un lugar específico (útil para mostrar opciones)
  @Get('from/:placeId')
  async findRoutesFromPlace(@Param('placeId') placeId: string) {
    try {
      const routes = await this.customRoutesService.findRoutesFromPlace(placeId);
      return {
        success: true,
        data: routes,
        total: routes.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Rutas hacia un lugar específico
  @Get('to/:placeId')
  async findRoutesToPlace(@Param('placeId') placeId: string) {
    try {
      const routes = await this.customRoutesService.findRoutesToPlace(placeId);
      return {
        success: true,
        data: routes,
        total: routes.length,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const route = await this.customRoutesService.findOne(id);
      return {
        success: true,
        data: route,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.NOT_FOUND,
      };
    }
  }

  // Solo administradores pueden actualizar rutas
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updateCustomRouteDto: UpdateCustomRouteDto,
  ) {
    try {
      const route = await this.customRoutesService.update(id, updateCustomRouteDto);
      return {
        success: true,
        message: 'Ruta personalizada actualizada exitosamente',
        data: route,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // Solo administradores pueden eliminar rutas
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    try {
      await this.customRoutesService.remove(id);
      return {
        success: true,
        message: 'Ruta personalizada eliminada exitosamente',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }
}