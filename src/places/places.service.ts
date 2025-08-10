// src/places/places.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleMapsService } from '../google-maps/google-maps.service';
import { CreatePlaceDto } from './dto/create-place.dto';
import { UpdatePlaceDto } from './dto/update-place.dto';
import { SearchPlacesDto } from './dto/search-places.dto';

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    private prisma: PrismaService,
    private googleMapsService: GoogleMapsService,
  ) {}

  async create(createPlaceDto: CreatePlaceDto) {
    // Validar que el tipo de lugar existe
    const placeType = await this.prisma.placeType.findUnique({
      where: { id: createPlaceDto.tipoId },
    });

    if (!placeType) {
      throw new BadRequestException(`Tipo de lugar con ID ${createPlaceDto.tipoId} no encontrado`);
    }

    // Validar coordenadas del campus
    const isValidCampus = await this.googleMapsService.validateCampusCoordinates({
      lat: createPlaceDto.latitud,
      lng: createPlaceDto.longitud,
    });

    if (!isValidCampus) {
      this.logger.warn(`Coordinates outside campus: ${createPlaceDto.latitud}, ${createPlaceDto.longitud}`);
      // No lanzar error, solo advertencia - permitir coordenadas fuera del campus para flexibilidad
    }

    // Verificar que no exista un lugar muy cerca (dentro de 10 metros)
    const nearbyPlaces = await this.findNearbyPlaces(
      createPlaceDto.latitud,
      createPlaceDto.longitud,
      10
    );

    if (nearbyPlaces.length > 0) {
      throw new ConflictException(
        `Ya existe un lugar muy cerca de estas coordenadas: ${nearbyPlaces[0].nombre}`
      );
    }

    // Generar código QR único si no se proporciona
    if (!createPlaceDto.codigoQR) {
      createPlaceDto.codigoQR = this.generateUniqueQRCode(createPlaceDto.nombre);
    }

    return this.prisma.place.create({
      data: createPlaceDto,
      include: {
        tipo: true,
      },
    });
  }

  async findAll(searchDto: SearchPlacesDto = {}) {
    const { page = 1, limit = 20, nearLat, nearLng, radius = 1000, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    // Construir filtros para la búsqueda
    const where: any = {};

    if (filters.nombre) {
      where.nombre = {
        contains: filters.nombre,
        mode: 'insensitive',
      };
    }

    if (filters.tipoId) {
      where.tipoId = filters.tipoId;
    }

    if (filters.edificio) {
      where.edificio = {
        contains: filters.edificio,
        mode: 'insensitive',
      };
    }

    if (filters.piso !== undefined) {
      where.piso = filters.piso;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const places = await this.prisma.place.findMany({
      where,
      include: {
        tipo: true,
        _count: {
          select: {
            rutasOrigen: true,
            rutasDestino: true,
          },
        },
      },
      skip,
      take: limit,
      orderBy: { nombre: 'asc' },
    });

    // Si se especificaron coordenadas, filtrar por proximidad y calcular distancias
    let filteredPlaces = places;
    if (nearLat && nearLng) {
      filteredPlaces = places
        .map(place => ({
          ...place,
          distancia: this.googleMapsService.calculateDirectDistance(
            { lat: nearLat, lng: nearLng },
            { lat: place.latitud, lng: place.longitud }
          ),
        }))
        .filter(place => place.distancia <= radius)
        .sort((a, b) => a.distancia - b.distancia);
    }

    const total = await this.prisma.place.count({ where });

    return {
      places: filteredPlaces,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const place = await this.prisma.place.findUnique({
      where: { id },
      include: {
        tipo: true,
        rutasOrigen: {
          include: {
            destino: {
              select: { id: true, nombre: true, latitud: true, longitud: true },
            },
          },
        },
        rutasDestino: {
          include: {
            origen: {
              select: { id: true, nombre: true, latitud: true, longitud: true },
            },
          },
        },
      },
    });

    if (!place) {
      throw new NotFoundException(`Lugar con ID ${id} no encontrado`);
    }

    return place;
  }

  async update(id: string, updatePlaceDto: UpdatePlaceDto) {
    // Verificar que el lugar existe
    const existingPlace = await this.findOne(id);

    // Si se está actualizando el tipo, validar que existe
    if (updatePlaceDto.tipoId) {
      const placeType = await this.prisma.placeType.findUnique({
        where: { id: updatePlaceDto.tipoId },
      });

      if (!placeType) {
        throw new BadRequestException(`Tipo de lugar con ID ${updatePlaceDto.tipoId} no encontrado`);
      }
    }

    // Si se están actualizando coordenadas, validar campus
    if (updatePlaceDto.latitud || updatePlaceDto.longitud) {
      const newLat = updatePlaceDto.latitud ?? existingPlace.latitud;
      const newLng = updatePlaceDto.longitud ?? existingPlace.longitud;

      const isValidCampus = await this.googleMapsService.validateCampusCoordinates({
        lat: newLat,
        lng: newLng,
      });

      if (!isValidCampus) {
        this.logger.warn(`Updated coordinates outside campus: ${newLat}, ${newLng}`);
      }
    }

    return this.prisma.place.update({
      where: { id },
      data: updatePlaceDto,
      include: {
        tipo: true,
      },
    });
  }

  async remove(id: string) {
    // Verificar que el lugar existe
    await this.findOne(id);

    // Verificar que no tenga rutas asociadas
    const routesCount = await this.prisma.customRoute.count({
      where: {
        OR: [
          { origenId: id },
          { destinoId: id },
        ],
      },
    });

    if (routesCount > 0) {
      throw new ConflictException(`No se puede eliminar el lugar porque tiene ${routesCount} rutas asociadas`);
    }

    return this.prisma.place.delete({
      where: { id },
    });
  }

  // Buscar lugares cercanos a unas coordenadas
  private async findNearbyPlaces(lat: number, lng: number, radiusMeters: number) {
    const places = await this.prisma.place.findMany();
    
    return places.filter(place => {
      const distance = this.googleMapsService.calculateDirectDistance(
        { lat, lng },
        { lat: place.latitud, lng: place.longitud }
      );
      return distance <= radiusMeters;
    });
  }

  // Generar código QR único
  private generateUniqueQRCode(nombre: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const cleanName = nombre.toLowerCase().replace(/\s+/g, '_');
    return `tecsup_${cleanName}_${timestamp}_${random}`;
  }

  // Obtener estadísticas de lugares
  async getStats() {
    const total = await this.prisma.place.count();
    const active = await this.prisma.place.count({ where: { isActive: true } });
    const inactive = total - active;

    const byType = await this.prisma.place.groupBy({
      by: ['tipoId'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const typeStats = await Promise.all(
      byType.map(async (item) => {
        const tipo = await this.prisma.placeType.findUnique({
          where: { id: item.tipoId },
        });
        return {
          tipo: tipo?.nombre || 'Desconocido',
          count: item._count.id,
        };
      })
    );

    const byBuilding = await this.prisma.place.groupBy({
      by: ['edificio'],
      _count: {
        id: true,
      },
      where: {
        edificio: {
          not: null,
        },
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    return {
      total,
      active,
      inactive,
      byType: typeStats,
      byBuilding: byBuilding.map(item => ({
        edificio: item.edificio,
        count: item._count.id,
      })),
    };
  }

  // Buscar lugares por texto (nombre, descripción, etc.)
  async searchByText(query: string) {
    return this.prisma.place.findMany({
      where: {
        OR: [
          {
            nombre: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            descripcion: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            edificio: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            tipo: {
              nombre: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
        ],
        isActive: true,
      },
      include: {
        tipo: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }
}