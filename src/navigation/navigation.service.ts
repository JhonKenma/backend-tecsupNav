// src/navigation/navigation.service.ts
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleMapsService, Coordinates } from '../google-maps/google-maps.service';
import { PlacesService } from '../places/places.service';
import { CustomRoutesService } from '../custom-routes/custom-routes.service';

export interface NavigationRequest {
  currentLocation: Coordinates;
  destinationId?: string;
  destinationName?: string;
  preferences?: {
    mode?: 'walking' | 'driving';
    accessible?: boolean;
    fastest?: boolean;
  };
}

export interface SearchRequest {
  query: string;
  currentLocation?: Coordinates;
  maxResults?: number;
  radius?: number;
}

export interface PlaceWithDistance {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  descripcion?: string | null;
  edificio?: string | null;
  piso?: number | null;
  tipo: {
    nombre: string;
    color: string | null;
    icono?: string | null;
  };
  distancia: number;
  tiempoEstimadoCaminando: number;
}

export interface NavigationResponse {
  route: {
    puntos: Coordinates[];
    distancia: number;
    tiempoEstimado: number;
    dificultad?: string;
    accesible: boolean;
  };
  destination: {
    id: string;
    nombre: string;
    latitud: number;
    longitud: number;
    tipo: string;
    edificio?: string;
    piso?: number;
  };
  instructions: string[];
  alternatives?: any[];
}

@Injectable()
export class NavigationService {
  private readonly logger = new Logger(NavigationService.name);

  constructor(
    private prisma: PrismaService,
    private googleMapsService: GoogleMapsService,
    private placesService: PlacesService,
    private customRoutesService: CustomRoutesService,
  ) {}

  /**
   * Validar que la ubicación GPS esté dentro del campus
   */
  async validateGPSLocation(location: Coordinates): Promise<{ valid: boolean; message: string }> {
    if (!location.lat || !location.lng) {
      return {
        valid: false,
        message: 'GPS no activado. Por favor, activa la ubicación en tu dispositivo.',
      };
    }

    const isWithinCampus = await this.googleMapsService.validateCampusCoordinates(location);
    
    if (!isWithinCampus) {
      return {
        valid: false,
        message: 'Tu ubicación está fuera del campus de Tecsup. Asegúrate de estar dentro de las instalaciones.',
      };
    }

    return {
      valid: true,
      message: 'Ubicación GPS válida dentro del campus.',
    };
  }

  /**
   * Buscar lugares por texto (para búsqueda por texto y comandos de voz)
   */
  async searchPlaces(searchRequest: SearchRequest): Promise<PlaceWithDistance[]> {
    const { query, currentLocation, maxResults = 10, radius = 1000 } = searchRequest;

    if (!query || query.trim().length < 2) {
      throw new BadRequestException('La búsqueda debe tener al menos 2 caracteres');
    }

    const cleanQuery = query.trim().toLowerCase();

    // Buscar lugares que coincidan con el texto
    const places = await this.prisma.place.findMany({
      where: {
        AND: [
          { isActive: true },
          {
            OR: [
              {
                nombre: {
                  contains: cleanQuery,
                  mode: 'insensitive',
                },
              },
              {
                descripcion: {
                  contains: cleanQuery,
                  mode: 'insensitive',
                },
              },
              {
                edificio: {
                  contains: cleanQuery,
                  mode: 'insensitive',
                },
              },
              {
                tipo: {
                  nombre: {
                    contains: cleanQuery,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        tipo: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });

    let placesWithDistance: PlaceWithDistance[] = places.map(place => {
      let distancia = 0;
      let tiempoEstimadoCaminando = 0;

      // Calcular distancia si se proporciona ubicación actual
      if (currentLocation) {
        distancia = this.googleMapsService.calculateDirectDistance(
          currentLocation,
          { lat: place.latitud, lng: place.longitud }
        );
        // Tiempo estimado caminando: 5 km/h = 83.33 m/min
        tiempoEstimadoCaminando = Math.ceil(distancia / 83.33);
      }

      return {
        id: place.id,
        nombre: place.nombre,
        latitud: place.latitud,
        longitud: place.longitud,
        descripcion: place.descripcion,
        edificio: place.edificio,
        piso: place.piso,
        tipo: {
          nombre: place.tipo.nombre,
          color: place.tipo.color,
          icono: place.tipo.icono,
        },
        distancia,
        tiempoEstimadoCaminando,
      };
    });

    // Filtrar por radio si se proporciona ubicación
    if (currentLocation) {
      placesWithDistance = placesWithDistance
        .filter(place => place.distancia <= radius)
        .sort((a, b) => a.distancia - b.distancia);
    }

    // Limitar resultados
    return placesWithDistance.slice(0, maxResults);
  }

  /**
   * Crear ruta desde ubicación actual hasta un destino
   */
  async createRouteFromCurrentLocation(request: NavigationRequest): Promise<NavigationResponse> {
    const { currentLocation, destinationId, destinationName, preferences = {} } = request;

    // Validar GPS primero
    const gpsValidation = await this.validateGPSLocation(currentLocation);
    if (!gpsValidation.valid) {
      throw new BadRequestException(gpsValidation.message);
    }

    // Encontrar destino
    let destination;
    if (destinationId) {
      destination = await this.prisma.place.findUnique({
        where: { id: destinationId },
        include: { tipo: true },
      });
    } else if (destinationName) {
      destination = await this.findPlaceByName(destinationName);
    }

    if (!destination) {
      throw new NotFoundException('Destino no encontrado');
    }

    // Buscar si existe una ruta personalizada desde un lugar cercano
    const nearbyPlace = await this.findNearestPlace(currentLocation);
    let customRoute: any = null;

    if (nearbyPlace && nearbyPlace.distancia < 50) { // Solo si está muy cerca (50m)
      try {
        customRoute = await this.customRoutesService.findFastestRoute(
          nearbyPlace.id,
          destination.id
        );
      } catch (error) {
        // No hay ruta personalizada, usaremos Google Maps
        this.logger.debug('No custom route found, using Google Maps');
        customRoute = null;
      }
    }

    let routeInfo;
    let instructions: string[] = [];

    if (customRoute && !customRoute.isReversed) {
      // Usar ruta personalizada
      routeInfo = {
        puntos: [
          currentLocation,
          ...(Array.isArray(customRoute.puntos) ? customRoute.puntos as Coordinates[] : []),
        ],
        distancia: customRoute.distancia || 0,
        tiempoEstimado: customRoute.tiempoEstimado || 0,
        dificultad: customRoute.dificultad,
        accesible: customRoute.accesible || false,
      };

      instructions = this.generateCustomInstructions(customRoute, nearbyPlace, destination);
    } else {
      // Calcular ruta con Google Maps
      try {
        const googleRoute = await this.googleMapsService.calculateRoute({
          origen: currentLocation,
          destino: { lat: destination.latitud, lng: destination.longitud },
          modo: preferences.mode || 'walking',
          optimizar: true,
        });

        routeInfo = {
          puntos: googleRoute.puntos,
          distancia: googleRoute.distancia,
          tiempoEstimado: googleRoute.tiempoEstimado,
          accesible: preferences.accessible || false,
        };

        instructions = this.generateGoogleInstructions(googleRoute, destination);
      } catch (error) {
        // Fallback: ruta directa
        const directDistance = this.googleMapsService.calculateDirectDistance(
          currentLocation,
          { lat: destination.latitud, lng: destination.longitud }
        );

        routeInfo = {
          puntos: [
            currentLocation,
            { lat: destination.latitud, lng: destination.longitud },
          ],
          distancia: directDistance,
          tiempoEstimado: Math.ceil((directDistance / 1000) * 12), // 12 min por km
          accesible: false,
        };

        instructions = [
          'Dirígete hacia el norte desde tu ubicación actual',
          `Camina aproximadamente ${Math.round(directDistance)}m hacia ${destination.nombre}`,
          `Llegarás a ${destination.nombre} en aproximadamente ${Math.ceil(directDistance / 83.33)} minutos`,
        ];
      }
    }

    this.logger.log(`Navigation created: ${routeInfo.distancia}m to ${destination.nombre}`);

    return {
      route: routeInfo,
      destination: {
        id: destination.id,
        nombre: destination.nombre,
        latitud: destination.latitud,
        longitud: destination.longitud,
        tipo: destination.tipo.nombre,
        edificio: destination.edificio,
        piso: destination.piso,
      },
      instructions,
    };
  }

  /**
   * Buscar lugares cercanos a la ubicación actual
   */
  async findNearbyPlaces(location: Coordinates, radius: number = 50): Promise<PlaceWithDistance[]> {
    const allPlaces = await this.prisma.place.findMany({
      where: { isActive: true },
      include: { tipo: true },
    });

    return allPlaces
      .map(place => {
        const distancia = this.googleMapsService.calculateDirectDistance(
          location,
          { lat: place.latitud, lng: place.longitud }
        );

        return {
          id: place.id,
          nombre: place.nombre,
          latitud: place.latitud,
          longitud: place.longitud,
          descripcion: place.descripcion,
          edificio: place.edificio,
          piso: place.piso,
          tipo: {
            nombre: place.tipo.nombre,
            color: place.tipo.color,
            icono: place.tipo.icono,
          },
          distancia,
          tiempoEstimadoCaminando: Math.ceil(distancia / 83.33),
        };
      })
      .filter(place => place.distancia <= radius)
      .sort((a, b) => a.distancia - b.distancia);
  }

  /**
   * Buscar lugar más cercano a una ubicación
   */
  private async findNearestPlace(location: Coordinates) {
    const nearbyPlaces = await this.findNearbyPlaces(location, 100);
    return nearbyPlaces.length > 0 ? nearbyPlaces[0] : null;
  }

  /**
   * Buscar lugar por nombre (útil para comandos de voz)
   */
  private async findPlaceByName(name: string) {
    return this.prisma.place.findFirst({
      where: {
        OR: [
          {
            nombre: {
              contains: name,
              mode: 'insensitive',
            },
          },
          {
            descripcion: {
              contains: name,
              mode: 'insensitive',
            },
          },
        ],
        isActive: true,
      },
      include: { tipo: true },
    });
  }

  /**
   * Generar instrucciones para rutas personalizadas
   */
  private generateCustomInstructions(customRoute: any, nearbyPlace: any, destination: any): string[] {
    const instructions = [
      `Desde tu ubicación actual, dirígete hacia ${nearbyPlace?.nombre || 'el punto de inicio'}`,
    ];

    if (customRoute.notas) {
      instructions.push(`Nota importante: ${customRoute.notas}`);
    }

    if (customRoute.accesible) {
      instructions.push('Esta ruta es accesible para personas con discapacidad');
    }

    if (customRoute.dificultad) {
      const dificultadTexto = {
        facil: 'Ruta fácil de seguir',
        medio: 'Ruta de dificultad media',
        dificil: 'Ruta que requiere atención extra',
      };
      instructions.push(dificultadTexto[customRoute.dificultad] || '');
    }

    instructions.push(
      `Sigue la ruta marcada hasta llegar a ${destination.nombre}`,
      `Tiempo estimado: ${customRoute.tiempoEstimado} minutos`,
      `Distancia: ${Math.round(customRoute.distancia)}m`,
    );

    return instructions.filter(Boolean);
  }

  /**
   * Generar instrucciones para rutas de Google Maps
   */
  private generateGoogleInstructions(googleRoute: any, destination: any): string[] {
    return [
      'Sigue la ruta calculada automáticamente',
      `Dirígete hacia ${destination.nombre}`,
      `Tiempo estimado: ${googleRoute.tiempoEstimado} minutos`,
      `Distancia: ${Math.round(googleRoute.distancia)}m`,
      'Mantén activo el GPS para navegación en tiempo real',
    ];
  }

  /**
   * Obtener información de navegación actualizada durante el recorrido
   */
  async getNavigationUpdate(currentLocation: Coordinates, destinationId: string) {
    const destination = await this.prisma.place.findUnique({
      where: { id: destinationId },
      include: { tipo: true },
    });

    if (!destination) {
      throw new NotFoundException('Destino no encontrado');
    }

    const distanciaRestante = this.googleMapsService.calculateDirectDistance(
      currentLocation,
      { lat: destination.latitud, lng: destination.longitud }
    );

    const tiempoRestante = Math.ceil(distanciaRestante / 83.33); // 5 km/h

    return {
      distanciaRestante: Math.round(distanciaRestante),
      tiempoRestante,
      llegada: distanciaRestante < 10, // Llegó si está a menos de 10m
      mensaje: distanciaRestante < 10 
        ? `¡Has llegado a ${destination.nombre}!`
        : `Te faltan ${Math.round(distanciaRestante)}m para llegar a ${destination.nombre}`,
    };
  }
}