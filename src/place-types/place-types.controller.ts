// src/place-types/place-types.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import { PlaceTypesService } from './place-types.service';
import { CreatePlaceTypeDto } from './dto/create-place-type.dto';
import { UpdatePlaceTypeDto } from './dto/update-place-type.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('place-types')
@UseGuards(JwtAuthGuard)
export class PlaceTypesController {
  constructor(private readonly placeTypesService: PlaceTypesService) {}

  // Solo administradores pueden crear tipos
  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body(ValidationPipe) createPlaceTypeDto: CreatePlaceTypeDto) {
    try {
      const placeType = await this.placeTypesService.create(createPlaceTypeDto);
      return {
        success: true,
        message: 'Tipo de lugar creado exitosamente',
        data: placeType,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: HttpStatus.BAD_REQUEST,
      };
    }
  }

  // Todos los usuarios autenticados pueden ver los tipos
  @Get()
  async findAll() {
    try {
      const placeTypes = await this.placeTypesService.findAll();
      return {
        success: true,
        data: placeTypes,
        total: placeTypes.length,
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
      const stats = await this.placeTypesService.getStats();
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
      const placeType = await this.placeTypesService.findOne(id);
      return {
        success: true,
        data: placeType,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.NOT_FOUND,
      };
    }
  }

  // Solo administradores pueden actualizar tipos
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body(ValidationPipe) updatePlaceTypeDto: UpdatePlaceTypeDto,
  ) {
    try {
      const placeType = await this.placeTypesService.update(id, updatePlaceTypeDto);
      return {
        success: true,
        message: 'Tipo de lugar actualizado exitosamente',
        data: placeType,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  // Solo administradores pueden eliminar tipos
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    try {
      await this.placeTypesService.remove(id);
      return {
        success: true,
        message: 'Tipo de lugar eliminado exitosamente',
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