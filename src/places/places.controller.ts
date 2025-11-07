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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { PlacesService } from './places.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { SearchPlacesDto } from './dto/search-places.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('places')
@ApiBearerAuth()
@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('imagen', {
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return callback(
          new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, gif, webp)'),
          false,
        );
      }
      callback(null, true);
    },
  }))
  @ApiOperation({ summary: 'Crear un nuevo lugar (Solo Admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['nombre', 'latitud', 'longitud', 'tipoId'],
      properties: {
        nombre: { type: 'string', example: 'Biblioteca Central' },
        latitud: { type: 'number', example: -12.0464 },
        longitud: { type: 'number', example: -77.0428 },
        tipoId: { type: 'string', example: 'cm123abc456' },
        descripcion: { type: 'string', example: 'Biblioteca principal' },
        imagen: { type: 'string', format: 'binary' },
        isActive: { type: 'boolean', example: true },
        piso: { type: 'number', example: 2 },
        edificio: { type: 'string', example: 'Edificio A' },
        codigoQR: { type: 'string', example: 'tecsup_biblioteca_123' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Lugar creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async create(
    @Body() body: any, // ✅ Cambiar a any para recibir FormData
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      // ✅ Construir el DTO manualmente desde el body
      const createPlaceDto: CreatePlaceDto = {
        nombre: body.nombre,
        latitud: parseFloat(body.latitud),
        longitud: parseFloat(body.longitud),
        tipoId: body.tipoId,
        descripcion: body.descripcion,
        isActive: body.isActive === 'true' || body.isActive === true,
        piso: body.piso ? parseInt(body.piso) : undefined,
        edificio: body.edificio,
        codigoQR: body.codigoQR,
      };

      // ✅ Validar manualmente
      if (!createPlaceDto.nombre) {
        throw new BadRequestException('El nombre es requerido');
      }
      if (!createPlaceDto.tipoId) {
        throw new BadRequestException('El tipo de lugar es requerido');
      }
      if (isNaN(createPlaceDto.latitud) || createPlaceDto.latitud < -90 || createPlaceDto.latitud > 90) {
        throw new BadRequestException('La latitud debe ser un número válido entre -90 y 90');
      }
      if (isNaN(createPlaceDto.longitud) || createPlaceDto.longitud < -180 || createPlaceDto.longitud > 180) {
        throw new BadRequestException('La longitud debe ser un número válido entre -180 y 180');
      }

      const place = await this.placesService.create(createPlaceDto, file);
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

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('imagen', {
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (req, file, callback) => {
      if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
        return callback(
          new BadRequestException('Solo se permiten imágenes (jpg, jpeg, png, gif, webp)'),
          false,
        );
      }
      callback(null, true);
    },
  }))
  @ApiOperation({ summary: 'Actualizar lugar (Solo Admin)' })
  @ApiConsumes('multipart/form-data')
  async update(
    @Param('id') id: string,
    @Body() body: any, // ✅ Cambiar a any
    @UploadedFile() file: Express.Multer.File,
  ) {
    try {
      // ✅ Construir el DTO manualmente
      const updatePlaceDto: UpdatePlaceDto = {};
      
      if (body.nombre) updatePlaceDto.nombre = body.nombre;
      if (body.latitud) updatePlaceDto.latitud = parseFloat(body.latitud);
      if (body.longitud) updatePlaceDto.longitud = parseFloat(body.longitud);
      if (body.tipoId) updatePlaceDto.tipoId = body.tipoId;
      if (body.descripcion !== undefined) updatePlaceDto.descripcion = body.descripcion;
      if (body.isActive !== undefined) updatePlaceDto.isActive = body.isActive === 'true' || body.isActive === true;
      if (body.piso !== undefined) updatePlaceDto.piso = parseInt(body.piso);
      if (body.edificio !== undefined) updatePlaceDto.edificio = body.edificio;
      if (body.codigoQR !== undefined) updatePlaceDto.codigoQR = body.codigoQR;

      const place = await this.placesService.update(id, updatePlaceDto, file);
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