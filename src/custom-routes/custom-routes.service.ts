// src/custom-routes/custom-routes.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleMapsService, Coordinates } from '../google-maps/google-maps.service';
import { CreateCustomRouteDto, CoordinateDto } from './dto/create-custom-route.dto';
import { UpdateCustomRouteDto } from './dto/update-custom-route.dto';
import { SearchRoutesDto } from './dto/search-routes.dto';

@Injectable()
export class CustomRoutesService {
  private readonly logger = new Logger(CustomRoutesService.name);

  constructor(
    private prisma: PrismaService,
    private googleMapsService: GoogleMapsService,
  ) {}

  async create(createCustomRouteDto: CreateCustomRouteDto) {
    const { origenId, destinoId, autoCalculate = true, puntos, ...routeData } = createCustomRouteDto;

    // Validar que origen y destino existen
    const [origen, destino] = await Promise.all([
      this.prisma.place.findUnique({ where: { id: origenId } }),
      this.prisma.place.findUnique({ where: { id: destinoId } }),
    ]);

    if (!origen) {
      throw new BadRequestException(`Lugar de origen con ID ${origenId} no encontrado`);
    }

    if (!destino) {
      throw new BadRequestException(`Lugar de destino con ID ${destinoId} no encontrado`);
    }

    if (origenId === destinoId) {
      throw new BadRequestException('El origen y destino no pueden ser el mismo lugar');
    }

    // Verificar si ya existe una ruta entre estos lugares
    const existingRoute = await this.prisma.customRoute.findFirst({
      where: {
        origenId,
        destinoId,
      },
    });

    if (existingRoute) {
      throw new ConflictException(`Ya existe una ruta entre ${origen.nombre} y ${destino.nombre}`);
    }

    let routePoints: CoordinateDto[] = puntos || [];
    let calculatedDistance: number | undefined;
    let calculatedTime: number | undefined;

    // Calcular ruta automáticamente si se solicita o no se proporcionaron puntos
    if (autoCalculate || !puntos || puntos.length < 2) {
      try {
        const routeInfo = await this.googleMapsService.calculateRoute({
          origen: { lat: origen.latitud, lng: origen.longitud },
          destino: { lat: destino.latitud, lng: destino.longitud },
          modo: 'walking',
          optimizar: true,
        });

        routePoints = routeInfo.puntos;
        calculatedDistance = routeInfo.distancia;
        calculatedTime = routeInfo.tiempoEstimado;

        this.logger.log(`Route calculated automatically: ${calculatedDistance}m, ${calculatedTime}min`);
      } catch (error) {
        this.logger.error(`Error calculating route automatically: ${error.message}`);
        
        // Si falla el cálculo automático, usar coordenadas directas
        routePoints = [
          { lat: origen.latitud, lng: origen.longitud },
          { lat: destino.latitud, lng: destino.longitud },
        ];
        
        // Calcular distancia directa como fallback
        calculatedDistance = this.googleMapsService.calculateDirectDistance(
          { lat: origen.latitud, lng: origen.longitud },
          { lat: destino.latitud, lng: destino.longitud }
        );
        
        // Estimar tiempo basado en velocidad promedio de caminata (5 km/h)
        calculatedTime = Math.ceil((calculatedDistance / 1000) * 12); // 12 min por km
      }
    }

    // Usar valores calculados si no se proporcionaron
    const finalData = {
      origenId,
      destinoId,
      puntos: routePoints as any, // Cast para evitar problema de tipos JSON
      distancia: routeData.distancia ?? calculatedDistance,
      tiempoEstimado: routeData.tiempoEstimado ?? calculatedTime,
      nombre: routeData.nombre,
      dificultad: routeData.dificultad,
      accesible: routeData.accesible,
      notas: routeData.notas,
    };

    // Generar nombre automático si no se proporciona
    if (!finalData.nombre) {
      finalData.nombre = `${origen.nombre} → ${destino.nombre}`;
    }

    return this.prisma.customRoute.create({
      data: finalData,
      include: {
        origen: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            tipo: { select: { nombre: true, color: true } },
          },
        },
        destino: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            tipo: { select: { nombre: true, color: true } },
          },
        },
      },
    });
  }

  async findAll(searchDto: SearchRoutesDto = {}) {
    const { page = 1, limit = 20, ...filters } = searchDto;
    const skip = (page - 1) * limit;

    // Construir filtros
    const where: any = {};

    if (filters.origenId) {
      where.origenId = filters.origenId;
    }

    if (filters.destinoId) {
      where.destinoId = filters.destinoId;
    }

    if (filters.dificultad) {
      where.dificultad = filters.dificultad;
    }

    if (filters.accesible !== undefined) {
      where.accesible = filters.accesible;
    }

    if (filters.maxTiempo) {
      where.tiempoEstimado = {
        lte: filters.maxTiempo,
      };
    }

    if (filters.maxDistancia) {
      where.distancia = {
        lte: filters.maxDistancia,
      };
    }

    const routes = await this.prisma.customRoute.findMany({
      where,
      include: {
        origen: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            edificio: true,
            piso: true,
            tipo: { select: { nombre: true, color: true, icono: true } },
          },
        },
        destino: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            edificio: true,
            piso: true,
            tipo: { select: { nombre: true, color: true, icono: true } },
          },
        },
      },
      skip,
      take: limit,
      orderBy: [
        { tiempoEstimado: 'asc' },
        { nombre: 'asc' },
      ],
    });

    const total = await this.prisma.customRoute.count({ where });

    return {
      routes,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const route = await this.prisma.customRoute.findUnique({
      where: { id },
      include: {
        origen: {
          include: {
            tipo: true,
          },
        },
        destino: {
          include: {
            tipo: true,
          },
        },
      },
    });

    if (!route) {
      throw new NotFoundException(`Ruta con ID ${id} no encontrada`);
    }

    return route;
  }

  async update(id: string, updateCustomRouteDto: UpdateCustomRouteDto) {
    // Verificar que la ruta existe
    const existingRoute = await this.findOne(id);

    const { origenId, destinoId, autoCalculate, puntos, ...routeData } = updateCustomRouteDto;

    // Si se están cambiando origen o destino, validar
    if (origenId || destinoId) {
      const newOrigenId = origenId || existingRoute.origenId;
      const newDestinoId = destinoId || existingRoute.destinoId;

      if (newOrigenId === newDestinoId) {
        throw new BadRequestException('El origen y destino no pueden ser el mismo lugar');
      }

      // Verificar que los lugares existen
      if (origenId) {
        const origen = await this.prisma.place.findUnique({ where: { id: origenId } });
        if (!origen) {
          throw new BadRequestException(`Lugar de origen con ID ${origenId} no encontrado`);
        }
      }

      if (destinoId) {
        const destino = await this.prisma.place.findUnique({ where: { id: destinoId } });
        if (!destino) {
          throw new BadRequestException(`Lugar de destino con ID ${destinoId} no encontrado`);
        }
      }

      // Verificar que no existe otra ruta con la misma combinación
      const duplicateRoute = await this.prisma.customRoute.findFirst({
        where: {
          origenId: newOrigenId,
          destinoId: newDestinoId,
          NOT: { id },
        },
      });

      if (duplicateRoute) {
        throw new ConflictException('Ya existe otra ruta con la misma combinación origen-destino');
      }
    }

    // Preparar datos de actualización
    const updatedData: any = { ...routeData };

    // Recalcular ruta si se solicita
    if (autoCalculate && (origenId || destinoId)) {
      const origen = origenId 
        ? await this.prisma.place.findUnique({ where: { id: origenId } })
        : existingRoute.origen;
      
      const destino = destinoId 
        ? await this.prisma.place.findUnique({ where: { id: destinoId } })
        : existingRoute.destino;

      if (origen && destino) {
        try {
          const routeInfo = await this.googleMapsService.calculateRoute({
            origen: { lat: origen.latitud, lng: origen.longitud },
            destino: { lat: destino.latitud, lng: destino.longitud },
            modo: 'walking',
            optimizar: true,
          });

          updatedData.puntos = routeInfo.puntos as any;
          updatedData.distancia = routeInfo.distancia;
          updatedData.tiempoEstimado = routeInfo.tiempoEstimado;

          this.logger.log(`Route recalculated: ${routeInfo.distancia}m, ${routeInfo.tiempoEstimado}min`);
        } catch (error) {
          this.logger.error(`Error recalculating route: ${error.message}`);
        }
      }
    } else if (puntos) {
      updatedData.puntos = puntos as any;
    }

    // Agregar IDs de origen y destino si se proporcionaron
    if (origenId) updatedData.origenId = origenId;
    if (destinoId) updatedData.destinoId = destinoId;

    return this.prisma.customRoute.update({
      where: { id },
      data: updatedData,
      include: {
        origen: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            tipo: { select: { nombre: true, color: true } },
          },
        },
        destino: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            tipo: { select: { nombre: true, color: true } },
          },
        },
      },
    });
  }

  async remove(id: string) {
    // Verificar que la ruta existe
    await this.findOne(id);

    return this.prisma.customRoute.delete({
      where: { id },
    });
  }

  // Obtener rutas desde un lugar específico
  async findRoutesFromPlace(placeId: string) {
    return this.prisma.customRoute.findMany({
      where: { origenId: placeId },
      include: {
        destino: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            tipo: { select: { nombre: true, color: true, icono: true } },
          },
        },
      },
      orderBy: { tiempoEstimado: 'asc' },
    });
  }

  // Obtener rutas hacia un lugar específico
  async findRoutesToPlace(placeId: string) {
    return this.prisma.customRoute.findMany({
      where: { destinoId: placeId },
      include: {
        origen: {
          select: {
            id: true,
            nombre: true,
            latitud: true,
            longitud: true,
            tipo: { select: { nombre: true, color: true, icono: true } },
          },
        },
      },
      orderBy: { tiempoEstimado: 'asc' },
    });
  }

  // Obtener ruta más rápida entre dos lugares
  async findFastestRoute(origenId: string, destinoId: string) {
    const route = await this.prisma.customRoute.findFirst({
      where: {
        OR: [
          { origenId, destinoId },
          { origenId: destinoId, destinoId: origenId }, // Ruta inversa
        ],
      },
      include: {
        origen: true,
        destino: true,
      },
      orderBy: { tiempoEstimado: 'asc' },
    });

    if (!route) {
      throw new NotFoundException(`No se encontró ruta entre los lugares especificados`);
    }

    // Si la ruta está invertida, ajustar la respuesta
    if (route.origenId === destinoId) {
      return {
        ...route,
        puntos: Array.isArray(route.puntos) 
          ? (route.puntos as unknown as CoordinateDto[]).reverse()
          : route.puntos,
        isReversed: true,
      };
    }

    return {
      ...route,
      isReversed: false,
    };
  }

  // Estadísticas de rutas
  async getStats() {
    const total = await this.prisma.customRoute.count();
    
    const avgTime = await this.prisma.customRoute.aggregate({
      _avg: { tiempoEstimado: true },
    });

    const avgDistance = await this.prisma.customRoute.aggregate({
      _avg: { distancia: true },
    });

    const byDifficulty = await this.prisma.customRoute.groupBy({
      by: ['dificultad'],
      _count: { id: true },
    });

    const accessible = await this.prisma.customRoute.count({
      where: { accesible: true },
    });

    const mostUsedOrigins = await this.prisma.customRoute.groupBy({
      by: ['origenId'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return {
      total,
      averageTime: Math.round(avgTime._avg.tiempoEstimado || 0),
      averageDistance: Math.round(avgDistance._avg.distancia || 0),
      accessible,
      nonAccessible: total - accessible,
      byDifficulty: byDifficulty.map(item => ({
        dificultad: item.dificultad || 'No especificada',
        count: item._count.id,
      })),
      mostUsedOrigins: await Promise.all(
        mostUsedOrigins.map(async item => {
          const place = await this.prisma.place.findUnique({
            where: { id: item.origenId },
            select: { nombre: true },
          });
          return {
            placeName: place?.nombre || 'Desconocido',
            routeCount: item._count.id,
          };
        })
      ),
    };
  }
}