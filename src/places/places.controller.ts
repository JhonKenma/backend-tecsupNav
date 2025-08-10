// src/places/places.controller.ts
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
import { PlacesService } from './places.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { SearchPlacesDto } from './dto/search-places.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  // Solo administradores pueden crear lugares
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body(ValidationPipe) createPlaceDto: CreatePlaceDto) {
    try {
      const place = await this.placesService.create(createPlaceDto);
      return {
        success: true,
        message: 'Lugar creado exitosamente',
        data: place,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // Todos los usuarios autenticados pueden ver lugares
  @Get()
  async findAll(@Query() searchDto: SearchPlacesDto) {
    try {
      const result = await this.placesService.findAll(searchDto);
      return {
        success: true,
        data: result.places,
        pagination: result.pagination,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
      };
    }
  }

  // Búsqueda de texto para estudiantes (útil para el asistente de IA)
  @Get('search')
  async searchByText(@Query('q') query: string) {
    try {
      if (!query || query.trim().length < 2) {
        return {
          success: false,
          message: 'La consulta debe tener al menos 2 caracteres',
          statusCode: HttpStatus.BAD_REQUEST,
        };
      }

      const places = await this.placesService.searchByText(query.trim());
      return {
        success: true,
        data: places,
        total: places.length,
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
      const stats = await this.placesService.getStats();
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

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const place = await this.placesService.findOne(id);
      return {
        success: true,
        data: place,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.NOT_FOUND,
      };
    }
  }

  // Solo administradores pueden actualizar lugares
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updatePlaceDto: UpdatePlaceDto,
  ) {
    try {
      const place = await this.placesService.update(id, updatePlaceDto);
      return {
        success: true,
        message: 'Lugar actualizado exitosamente',
        data: place,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // Solo administradores pueden eliminar lugares
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    try {
      await this.placesService.remove(id);
      return {
        success: true,
        message: 'Lugar eliminado exitosamente',
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